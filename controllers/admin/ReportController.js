const { STATUS_CODES } = require('../../utils/constants');
const ReportModel = require('../../models/ReportModel');
const { v4: uuidv4 } = require('uuid');

class ReportController {
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
      const classification = req.query.classification;
      const procedureType = req.query.procedureType;
      const fromDate = req.query.fromDate;
      const toDate = req.query.toDate;
      const search = req.query.search;

      // Build filter object
      const filters = { };

      // Add status filter if provided
      if (status) {
        filters.status = status;
      }

      // Add classification filter if provided
      if (classification) {
        filters.classification = classification;
      }

      // Add procedure type filter if provided
      if (procedureType) {
        filters.procedureType = procedureType;
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

      // Fetch reports from database with filters and pagination
      const result = await ReportModel.get(filters, page, limit, search, dateFilters);

      // Return success response with data and pagination info
      return res.status(STATUS_CODES.OK).json({
        success: true,
        data: result.reports,
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
      console.error('Error fetching reports:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch reports'
      });
    }
  }

  async update(req, res) {
    try {
      // Get user ID from authenticated token
      const userId = req.user?.userId || req.user?.id;
      const { reportId } = req.params;
      
      // Check if user is authenticated
      if (!userId) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      if (!reportId) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Report ID is required'
        });
      }

      const { status, offenseLevel } = req.body;

      // Build update data object
      const updateData = {};
      let hasUpdates = false;
      
      // Validate and add status if provided
      if (status !== undefined) {
        const validStatuses = ['pending', 'investigating', 'resolved'];
        if (!validStatuses.includes(status)) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Invalid status. Valid statuses: pending, investigating, resolved'
          });
        }
        updateData.status = status;
        hasUpdates = true;
      }
      
      // Validate and add offenseLevel if provided
      if (offenseLevel !== undefined) {
        const validOffenseLevels = [
          'Physical Harassment',
          'Verbal Harassment',
          'Non-Verbal Harassment',
          'Cyber Sexual Harassment',
          'Not Harassment'
        ];
        
        // Allow null to clear offense level
        if (offenseLevel !== null && !validOffenseLevels.includes(offenseLevel)) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Invalid offense level. Valid values: Physical Harassment, Verbal Harassment, Non-Verbal Harassment, Cyber Sexual Harassment, Not Harassment'
          });
        }
        // Store offense level in the 'remarks' field (matches the database schema)
        updateData.remarks = offenseLevel;
        hasUpdates = true;
      }

      // Check if at least one field is being updated
      if (!hasUpdates) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'At least one field (status or offenseLevel) is required for update'
        });
      }

      // Add updated timestamp
      updateData.updatedAt = new Date();

      // Update report in database
      const updated = await ReportModel.update(reportId, updateData);

      if (!updated) {
        return res.status(STATUS_CODES.NOT_FOUND).json({
          success: false,
          message: 'Report not found or you do not have permission to update it'
        });
      }

      return res.status(STATUS_CODES.OK).json({
        success: true,
        message: 'Report updated successfully'
      });

    } catch (error) {
      console.error('Error updating report:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to update report'
      });
    }
  }
}

module.exports = new ReportController();