const { db } = require('../utils/database');
const { COLLECTIONS } = require('../utils/constants');
const AppointmentCache = require('../cache/appointmentCache');

class AppointmentModel {
  static get collection() {
    return COLLECTIONS.COLLECTIONS_APPOINTMENTS;
  }

  static async create(appointmentData) {
    try {
      const appointmentsRef = db.collection(this.collection);
      const docRef = await appointmentsRef.add(appointmentData);
      
      // Invalidate cache for this user after creating new appointment
      await AppointmentCache.invalidateUserCache(appointmentData.userId);
      
      return {
        id: docRef.id,
        ...appointmentData
      };
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  }

  static async get(filters = {}, page = 1, limit = 10, search = null, dateFilters = {}) {
    try {
      const userId = filters.userId;
      
      // Prepare filter object for cache key
      const cacheFilters = {
        page,
        limit,
        status: filters.status,
        consultationMode: filters.consultationMode,
        fromDate: dateFilters.fromDate,
        toDate: dateFilters.toDate,
        search
      };
      
      // Check cache first
      const cachedData = AppointmentCache.get(userId, cacheFilters);
      if (cachedData) {
        console.log('Returning cached appointments for user:', userId);
        return cachedData;
      }
      
      // If not in cache, fetch from database
      console.log('Fetching appointments from database for user:', userId);
      const appointmentsRef = db.collection(this.collection);
      let query = appointmentsRef;

      // Apply basic filters (userId, status, consultationMode)
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }
      
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      
      if (filters.consultationMode) {
        query = query.where('consultationMode', '==', filters.consultationMode);
      }

      // Apply date filters (using preferredDate for filtering)
      if (dateFilters.fromDate) {
        query = query.where('preferredDate', '>=', dateFilters.fromDate);
      }
      
      if (dateFilters.toDate) {
        query = query.where('preferredDate', '<=', dateFilters.toDate);
      }

      // Sort by creation date (newest first)
      query = query.orderBy('createdAt', 'desc');

      // Get total count for pagination
      let totalItems = 0;
      let allAppointments = [];

      if (search) {
        // If searching, get all documents and filter client-side
        const snapshot = await query.get();
        
        snapshot.forEach(doc => {
          const data = doc.data();
          allAppointments.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
            preferredDate: data.preferredDate?.toDate ? data.preferredDate.toDate() : data.preferredDate
          });
        });

        // Client-side search across searchable fields
        const searchLower = search.toLowerCase();
        const filteredAppointments = allAppointments.filter(appointment => {
          const fullNameMatch = appointment.fullName?.toLowerCase().includes(searchLower);
          const purposeMatch = appointment.purpose?.toLowerCase().includes(searchLower);
          const phoneMatch = appointment.phoneNumber?.toLowerCase().includes(searchLower);
          
          return fullNameMatch || purposeMatch || phoneMatch;
        });

        allAppointments = filteredAppointments;
        totalItems = allAppointments.length;

        // Apply pagination to filtered results
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedAppointments = allAppointments.slice(startIndex, endIndex);

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalItems / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        const result = {
          appointments: paginatedAppointments,
          totalItems,
          totalPages,
          hasPrevPage,
          hasNextPage,
          page,
          limit
        };
        
        // Store in cache
        AppointmentCache.set(userId, cacheFilters, result);
        
        return result;

      } else {
        // Get total count
        const countSnapshot = await query.count().get();
        totalItems = countSnapshot.data().count;

        // Apply pagination
        if (page > 1) {
          const offset = (page - 1) * limit;
          const prevPageSnapshot = await query.limit(offset).get();
          
          if (!prevPageSnapshot.empty) {
            const lastDoc = prevPageSnapshot.docs[prevPageSnapshot.docs.length - 1];
            query = query.startAfter(lastDoc);
          }
        }

        // Apply limit
        query = query.limit(limit);

        // Execute query
        const snapshot = await query.get();

        // Process results
        const appointments = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          appointments.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
            preferredDate: data.preferredDate?.toDate ? data.preferredDate.toDate() : data.preferredDate
          });
        });

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalItems / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        const result = {
          appointments,
          totalItems,
          totalPages,
          hasPrevPage,
          hasNextPage,
          page,
          limit
        };
        
        // Store in cache
        AppointmentCache.set(userId, cacheFilters, result);
        
        return result;
      }

    } catch (error) {
      console.error('Error getting appointments:', error);
      throw error;
    }
  }

  static async update(appointmentId, userId = '', updateData) {
    try {
      const appointmentsRef = db.collection(this.collection);
      let query = appointmentsRef.where('appointmentId', '==', appointmentId);
      
      // Check if userId is a non-empty string
      if (userId && typeof userId === 'string' && userId.trim()) {
        query = query.where('userId', '==', userId);
      }
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        return false;
      }
      
      const doc = snapshot.docs[0];
      await doc.ref.update(updateData);
      
      // Invalidate cache for this user after creating new appointment
      await AppointmentCache.invalidateAllAppointmentCache();
      
      return true;
      
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  }

  static async delete(appointmentId, userId) {
    try {
      const appointmentsRef = db.collection(this.collection);
      const query = appointmentsRef
        .where('appointmentId', '==', appointmentId)
        .where('userId', '==', userId);
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        return false;
      }
      
      const doc = snapshot.docs[0];
      await doc.ref.delete();
      
      // Invalidate cache for this user after deleting appointment
      await AppointmentCache.invalidateUserCache(userId);
      
      return true;
      
    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw error;
    }
  }

  // Dashboard
  static async getTotalAppointments() {
    try {
      const appointmentsRef = db.collection(this.collection);
      const snapshot = await appointmentsRef.count().get();
      return snapshot.data().count;
    } catch (error) {
      console.error('Error getting total appointments:', error);
      throw error;
    }
  }

  static async getAppointmentsByMode() {
    try {
      const appointmentsRef = db.collection(this.collection);
      const snapshot = await appointmentsRef.get();
      
      const modeCounts = {
        'in-person': 0,
        'video': 0,
        'phone': 0
      };

      snapshot.forEach(doc => {
        const appointment = doc.data();
        const mode = appointment.consultationMode;
        
        if (mode === 'in-person') {
          modeCounts['in-person']++;
        } else if (mode === 'video') {
          modeCounts['video']++;
        } else if (mode === 'phone') {
          modeCounts['phone']++;
        }
      });

      // Format for frontend (array of objects)
      return [
        { mode: 'In-person', count: modeCounts['in-person'] },
        { mode: 'Video call', count: modeCounts['video'] },
        { mode: 'Phone call', count: modeCounts['phone'] }
      ];

    } catch (error) {
      console.error('Error getting appointments by mode:', error);
      throw error;
    }
  }

  // Helpers
  static async checkDuplicateSlot(preferredDate, hour) {
    try {
      const appointmentsRef = db.collection(this.collection);
      
      // Create start and end time for the specific hour
      const startOfHour = new Date(preferredDate);
      startOfHour.setHours(hour, 0, 0, 0);
      
      const endOfHour = new Date(preferredDate);
      endOfHour.setHours(hour, 59, 59, 999);
      
      console.log('Checking for duplicates between:', startOfHour, 'and', endOfHour);
      
      // Query appointments for the specific hour slot
      const snapshot = await appointmentsRef
        .where('preferredDate', '>=', startOfHour)
        .where('preferredDate', '<=', endOfHour)
        .where('status', 'in', ['pending', 'confirmed'])
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      // Return the first existing appointment
      const doc = snapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data
      };
      
    } catch (error) {
      console.error('Error checking duplicate appointment:', error);
      throw error;
    }
  }

  static async getByDateAndTimeSlot(preferredDate, hour) {
    try {
      const appointmentsRef = db.collection(this.collection);
      
      // Create start and end time for the hour slot
      const startOfHour = new Date(preferredDate);
      startOfHour.setHours(hour, 0, 0, 0);
      
      const endOfHour = new Date(preferredDate);
      endOfHour.setHours(hour, 59, 59, 999);
      
      // Query appointments for the specific hour slot
      const query = appointmentsRef
        .where('preferredDate', '>=', startOfHour)
        .where('preferredDate', '<=', endOfHour)
        .where('status', 'in', ['pending', 'confirmed']); // Only check active appointments
      
      const snapshot = await query.get();
      
      const appointments = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        appointments.push({
          id: doc.id,
          ...data
        });
      });
      
      return appointments;
      
    } catch (error) {
      console.error('Error checking duplicate appointments:', error);
      throw error;
    }
  }

  static async countByUserIdAndStatus(userId, statuses) {
    try {
      const appointmentsRef = db.collection(this.collection);
      let query = appointmentsRef.where('userId', '==', userId);
      
      // Handle both single status and array of statuses
      if (Array.isArray(statuses)) {
        query = query.where('status', 'in', statuses);
      } else {
        query = query.where('status', '==', statuses);
      }
      
      const snapshot = await query.count().get();
      return snapshot.data().count;
    } catch (error) {
      console.error('Error counting appointments by user and status:', error);
      throw error;
    }
  }
}

module.exports = AppointmentModel;