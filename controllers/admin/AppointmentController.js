const { STATUS_CODES } = require('../../utils/constants');
const AppointmentModel = require('../../models/AppointmentModel');
const { v4: uuidv4 } = require('uuid');

class AppointmentController {
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
      const filters = {  };

      // Add status filter if provided
      if (status) {
        filters.status = status;
      }

      // Add consultation mode filter if provided
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

      const { status } = req.body;

      // Build update data object
      const updateData = {};
      
      // Only status field is allowed to be updated
      if (status === undefined) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Status is required for update'
        });
      }

      // Validate status - only allowed statuses: pending, confirmed, rejected, completed
      const validStatuses = ['pending', 'confirmed', 'rejected', 'completed'];
      if (!validStatuses.includes(status)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Status.'
        });
      }
      
      updateData.status = status;

      // Add updated timestamp
      updateData.updatedAt = new Date();

      // Update appointment in database
      const updated = await AppointmentModel.update(appointmentId, updateData);

      if (!updated) {
        return res.status(STATUS_CODES.NOT_FOUND).json({
          success: false,
          message: 'Appointment not found or you do not have permission to update it'
        });
      }

      return res.status(STATUS_CODES.OK).json({
        success: true,
        message: 'Appointment status updated successfully',
        data: {
          appointmentId,
          status: updateData.status,
          updatedAt: updateData.updatedAt
        }
      });

    } catch (error) {
      console.error('Error updating appointment:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to update appointment status'
      });
    }
  }
}

module.exports = new AppointmentController();