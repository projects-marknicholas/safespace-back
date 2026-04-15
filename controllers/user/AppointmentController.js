const { STATUS_CODES } = require('../../utils/constants');
const AppointmentModel = require('../../models/AppointmentModel');
const { v4: uuidv4 } = require('uuid');

class AppointmentController {
  async create(req, res) {
    try {
      // Get user ID from authenticated token
      const userId = req.user?.userId || req.user?.id;
      
      if (!userId) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const {
        fullName,
        phoneNumber,
        consultationMode,
        purpose,
        preferredDate,
        preferredTime,
        additionalNotes
      } = req.body;

      // Define required fields with display names
      const requiredFields = {
        fullName: "Full Name",
        phoneNumber: "Phone Number",
        consultationMode: "Consultation Mode",
        purpose: "Purpose",
        preferredDate: "Preferred Date",
        preferredTime: "Preferred Time"
      };

      // Check for missing required fields
      for (const [field, displayName] of Object.entries(requiredFields)) {
        if (!req.body[field]) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: `${displayName} is required`
          });
        }
      }

      // Validate fullName
      const nameRegex = /^[A-Za-z\s\-']+$/;
      const trimmedFullName = fullName?.trim();
      
      if (!trimmedFullName || !nameRegex.test(trimmedFullName)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Full Name can only contain letters, spaces, hyphens, and apostrophes'
        });
      }
      
      if (trimmedFullName.length > 100) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Full Name must not exceed 100 characters'
        });
      }

      // Validate phoneNumber
      const phoneRegex = /^\d{10,15}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Phone Number must be between 10 and 15 digits'
        });
      }

      // UPDATED: New consultation mode values
      const validModes = [
        'in-person-oash',
        'in-person-counseling',
        'video-call-oash',
        'video-call-counseling'
      ];
      if (!validModes.includes(consultationMode)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Consultation Mode. Must be in-person-oash, in-person-counseling, video-call-oash, or video-call-counseling'
        });
      }

      // Validate purpose
      if (!purpose || purpose.trim().length === 0) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Purpose is required'
        });
      }
      
      if (purpose.length > 1000) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Purpose must not exceed 1000 characters'
        });
      }

      // Validate preferredDate
      const preferredDateObj = new Date(preferredDate);
      if (isNaN(preferredDateObj.getTime())) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Preferred Date format'
        });
      }
      
      // Check if date is not in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (preferredDateObj < today) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Preferred Date cannot be in the past'
        });
      }

      // Validate time format - MUST BE HOURLY ONLY (HH:00)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):00$/;
      if (!timeRegex.test(preferredTime)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Preferred Time format. Only hourly slots are available. Please use HH:00 format (e.g., 09:00, 14:00, 16:00)'
        });
      }

      // Parse time
      const [hours, minutes] = preferredTime.split(':').map(Number);
      const timeInMinutes = hours * 60 + minutes;

      // Validate office hours based on day of week
      const dayOfWeek = preferredDateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

      // Validate based on day
      if (dayOfWeek === 0) { // Sunday
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Office is closed on Sundays. Please select a date from Monday to Saturday'
        });
      } else if (dayOfWeek === 6) { // Saturday
        // Saturday: 9:00 AM to 12:00 PM
        const saturdayStart = 9 * 60; // 9:00 AM = 540 minutes
        const saturdayEnd = 12 * 60; // 12:00 PM = 720 minutes
        
        if (timeInMinutes < saturdayStart || timeInMinutes >= saturdayEnd) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Saturday office hours are from 9:00 AM to 12:00 PM only. Available slots: 09:00, 10:00, 11:00'
          });
        }
      } else { // Monday to Friday
        // Weekdays: 8:00 AM to 5:00 PM
        const weekdayStart = 8 * 60; // 8:00 AM = 480 minutes
        const weekdayEnd = 17 * 60; // 5:00 PM = 1020 minutes
        
        if (timeInMinutes < weekdayStart || timeInMinutes >= weekdayEnd) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Weekday office hours are from 8:00 AM to 5:00 PM only. Available slots: 08:00, 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00'
          });
        }
      }

      // Check for duplicate appointments
      // Get all appointments for the same date and same hour
      const existingAppointment = await AppointmentModel.checkDuplicateSlot(
        preferredDateObj,
        hours
      );

      if (existingAppointment) {
        // Format the time for display
        const formattedTime = `${hours.toString().padStart(2, '0')}:00`;
        return res.status(STATUS_CODES.CONFLICT).json({
          success: false,
          message: `The time slot ${formattedTime} on ${preferredDate} is already booked. Please choose a different time slot.`
        });
      }

      // Validate additionalNotes (optional)
      if (additionalNotes && additionalNotes.length > 500) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Additional Notes must not exceed 500 characters'
        });
      }

      // Create appointment ID using uuid
      const appointmentId = uuidv4();

      // Create a date object that includes both date and time
      const appointmentDateTime = new Date(preferredDateObj);
      appointmentDateTime.setHours(hours, 0, 0, 0);

      // Prepare appointment data for insertion
      const appointmentData = {
        appointmentId: appointmentId,
        userId: userId,
        fullName: trimmedFullName,
        phoneNumber: phoneNumber,
        consultationMode: consultationMode,
        purpose: purpose.trim(),
        preferredDate: appointmentDateTime, // Store as full datetime
        preferredTime: `${hours.toString().padStart(2, '0')}:00`, // Store as HH:00 format
        additionalNotes: additionalNotes?.trim() || null,
        status: 'pending', // pending, confirmed, cancelled, completed
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert appointment into database
      const insertData = await AppointmentModel.create(appointmentData);

      // Check if insertion was successful
      if (!insertData) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Something went wrong while creating new appointment'
        });
      }

      return res.status(STATUS_CODES.CREATED).json({
        success: true,
        message: 'Appointment created successfully'
      });

    } catch (error) {
      console.error('Error creating appointment:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to create appointment'
      });
    }
  }

  async get(req, res) {
    try {
      // Get user ID from authenticated token
      const userId = req.user?.userId || req.user?.id;
      
      // Check if user is authenticated
      if (!userId) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Get pagination parameters from query string
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      
      // Get filter parameters from query string
      const status = req.query.status;
      const consultationMode = req.query.consultationMode;
      const fromDate = req.query.fromDate;
      const toDate = req.query.toDate;
      const search = req.query.search;

      // Build filter object
      const filters = { userId: userId };

      // Add status filter if provided
      if (status) {
        filters.status = status;
      }

      // Add consultation mode filter if provided (now accepts new values)
      if (consultationMode) {
        filters.consultationMode = consultationMode;
      }

      // Build date filters object
      const dateFilters = {};
      if (fromDate) {
        dateFilters.fromDate = new Date(fromDate);
      }
      if (toDate) {
        // Set to end of the day
        dateFilters.toDate = new Date(toDate + 'T23:59:59.999Z');
      }

      // Fetch appointments from database with filters and pagination
      const result = await AppointmentModel.get(filters, page, limit, search, dateFilters);

      // Return success response with data and pagination info
      return res.status(STATUS_CODES.OK).json({
        success: true,
        data: result.appointments,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.totalItems,
          totalPages: result.totalPages,
          hasPrev: result.hasPrevPage,
          hasNext: result.hasNextPage
        }
      });

    } catch (error) {
      console.error('Error fetching appointments:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch appointments'
      });
    }
  }

  async update(req, res) {
    try {
      // Get user ID from authenticated token
      const userId = req.user?.userId || req.user?.id;
      const { appointmentId } = req.params;
      
      // Check if user is authenticated
      if (!userId) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      if (!appointmentId) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Appointment ID is required'
        });
      }

      const {
        fullName,
        phoneNumber,
        consultationMode,
        purpose,
        preferredDate,
        preferredTime,
        additionalNotes,
        status
      } = req.body;

      // Build update data object
      const updateData = {};
      
      // Validate and add fields if provided
      if (fullName !== undefined) {
        const nameRegex = /^[A-Za-z\s\-']+$/;
        const trimmedFullName = fullName?.trim();
        
        if (!trimmedFullName || !nameRegex.test(trimmedFullName)) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Full Name can only contain letters, spaces, hyphens, and apostrophes'
          });
        }
        
        if (trimmedFullName.length > 100) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Full Name must not exceed 100 characters'
          });
        }
        
        updateData.fullName = trimmedFullName;
      }

      if (phoneNumber !== undefined) {
        const phoneRegex = /^\d{10,15}$/;
        if (!phoneRegex.test(phoneNumber)) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Phone Number must be between 10 and 15 digits'
          });
        }
        updateData.phoneNumber = phoneNumber;
      }

      if (consultationMode !== undefined) {
        // UPDATED: New consultation mode values for update as well
        const validModes = [
          'in-person-oash',
          'in-person-counseling',
          'video-call-oash',
          'video-call-counseling'
        ];
        if (!validModes.includes(consultationMode)) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Invalid Consultation Mode. Must be in-person-oash, in-person-counseling, video-call-oash, or video-call-counseling'
          });
        }
        updateData.consultationMode = consultationMode;
      }

      if (purpose !== undefined) {
        if (!purpose || purpose.trim().length === 0) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Purpose cannot be empty'
          });
        }
        
        if (purpose.length > 1000) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Purpose must not exceed 1000 characters'
          });
        }
        
        updateData.purpose = purpose.trim();
      }

      if (preferredDate !== undefined) {
        const preferredDateObj = new Date(preferredDate);
        if (isNaN(preferredDateObj.getTime())) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Invalid Preferred Date format'
          });
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (preferredDateObj < today) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Preferred Date cannot be in the past'
          });
        }
        
        updateData.preferredDate = preferredDateObj;
      }

      if (preferredTime !== undefined) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(preferredTime)) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Invalid Preferred Time format. Use HH:MM format (e.g., 14:30)'
          });
        }
        updateData.preferredTime = preferredTime;
      }

      if (additionalNotes !== undefined) {
        if (additionalNotes && additionalNotes.length > 500) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Additional Notes must not exceed 500 characters'
          });
        }
        updateData.additionalNotes = additionalNotes?.trim() || null;
      }

      if (status !== undefined) {
        const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
        if (!validStatuses.includes(status)) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Invalid Status. Must be pending, confirmed, cancelled, or completed'
          });
        }
        updateData.status = status;
      }

      // Add updated timestamp
      updateData.updatedAt = new Date();

      // Update appointment in database
      const updated = await AppointmentModel.update(appointmentId, userId, updateData);

      if (!updated) {
        return res.status(STATUS_CODES.NOT_FOUND).json({
          success: false,
          message: 'Appointment not found or you do not have permission to update it'
        });
      }

      return res.status(STATUS_CODES.OK).json({
        success: true,
        message: 'Appointment updated successfully'
      });

    } catch (error) {
      console.error('Error updating appointment:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to update appointment'
      });
    }
  }

  async delete(req, res) {
    try {
      // Get user ID from authenticated token
      const userId = req.user?.userId || req.user?.id;
      const { appointmentId } = req.params;
      
      // Check if user is authenticated
      if (!userId) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      if (!appointmentId) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Appointment ID is required'
        });
      }

      // Delete appointment from database
      const deleted = await AppointmentModel.delete(appointmentId, userId);

      if (!deleted) {
        return res.status(STATUS_CODES.NOT_FOUND).json({
          success: false,
          message: 'Appointment not found or you do not have permission to delete it'
        });
      }

      return res.status(STATUS_CODES.OK).json({
        success: true,
        message: 'Appointment deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting appointment:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to delete appointment'
      });
    }
  }
}

module.exports = new AppointmentController();