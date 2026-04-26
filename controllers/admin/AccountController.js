const { STATUS_CODES } = require('../../utils/constants');
const AccountModel = require('../../models/AccountModel');
const ReportModel = require('../../models/ReportModel');
const AppointmentModel = require('../../models/AppointmentModel');
const AuthModel = require('../../models/AuthModel');
const ort = require('onnxruntime-node');

class AccountController {
  async me(req, res) {
    try {
      const userId = req.user?.userId || req.user?.id;
      
      if (!userId) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const account = await AccountModel.findByUserId(userId);
      
      if (!account) {
        return res.status(STATUS_CODES.NOT_FOUND).json({
          success: false,
          message: 'Account not found'
        });
      }

      return res.status(STATUS_CODES.OK).json({
        success: true,
        data: account
      });
    } catch (error) {
      console.error('Error fetching account:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch account information'
      });
    }
  }

  async getUsers(req, res) {
    try {
      const userId = req.user?.userId || req.user?.id;
      
      if (!userId) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const role = req.query.role;
      const status = req.query.status;
      const fromDate = req.query.fromDate;
      const toDate = req.query.toDate;
      const search = req.query.search;

      const filters = {};
      if (role) filters.role = role;
      if (status) filters.status = status;

      const dateFilters = {};
      if (fromDate) dateFilters.fromDate = new Date(fromDate);
      if (toDate) dateFilters.toDate = new Date(toDate + 'T23:59:59.999Z');

      const result = await AccountModel.getUsers(filters, page, limit, search, dateFilters);

      return res.status(STATUS_CODES.OK).json({
        success: true,
        data: result.users,
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
      console.error('Error fetching users:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch users'
      });
    }
  }

  async updateRole(req, res) {
    try {
      const userId = req.user?.userId || req.user?.id;
      
      if (!userId) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const targetUserId = req.params.userId;
      
      if (!targetUserId) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const { role } = req.body;
      
      if (!role) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Role is required'
        });
      }

      const validRoles = ['user', 'admin'];
      if (!validRoles.includes(role.toLowerCase())) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid role. Allowed roles: user, admin'
        });
      }

      const targetUser = await AccountModel.findByUserId(targetUserId);
      if (!targetUser) {
        return res.status(STATUS_CODES.NOT_FOUND).json({
          success: false,
          message: 'User not found'
        });
      }

      if (targetUserId === userId) {
        return res.status(STATUS_CODES.FORBIDDEN).json({
          success: false,
          message: 'You cannot change your own role'
        });
      }

      const updatedUser = await AccountModel.updateRole(targetUserId, role.toLowerCase());

      if (!updatedUser) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Failed to update user role'
        });
      }

      return res.status(STATUS_CODES.OK).json({
        success: true,
        message: 'User role updated successfully',
        data: {
          userId: updatedUser.userId,
          fullName: updatedUser.fullName,
          email: updatedUser.email,
          role: updatedUser.role,
          updatedAt: updatedUser.updatedAt
        }
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to update user role'
      });
    }
  }

  async dashboard(req, res) {
    try {
      const userId = req.user?.userId || req.user?.id;
      
      if (!userId) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const now = new Date();
      const sixWeeksAgo = new Date(now);
      sixWeeksAgo.setDate(now.getDate() - 42);

      const totalReports = await ReportModel.getTotalReports();
      const pendingReports = await ReportModel.getPendingReports();
      const registeredUsers = await AuthModel.getTotalUsers();
      const totalAppointments = await AppointmentModel.getTotalAppointments();
      const reportsLast6Weeks = await ReportModel.getReportsLast6Weeks(sixWeeksAgo, now);
      const appointmentsByMode = await AppointmentModel.getAppointmentsByMode();
      const casesByCategory = await ReportModel.getReportsByCategory();
      const casesByOffenseLevel = await ReportModel.getReportsByOffenseLevel();
      const monthlyReports = await ReportModel.getMonthlyReports();
      const casesByLocation = await ReportModel.getReportsByLocation(); // ADDED

      return res.status(STATUS_CODES.OK).json({
        success: true,
        data: {
          summary: {
            totalReports,
            pendingReports,
            registeredUsers,
            totalAppointments
          },
          reportsLast6Weeks,
          appointmentsByMode,
          casesByCategory,
          casesByOffenseLevel,
          monthlyReports,
          casesByLocation // ADDED
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch dashboard data'
      });
    }
  }
}

module.exports = new AccountController();