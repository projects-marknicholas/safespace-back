const { STATUS_CODES } = require('../../utils/constants');
const ReportModel = require('../../models/ReportModel');
const { v4: uuidv4 } = require('uuid');

class ReportController {
  async create(req, res) {
    try {
      // Get user ID from authenticated token (added by AuthenticateToken middleware)
      const userId = req.user?.userId || req.user?.id;
      
      if (!userId) {
        return res.status(STATUS_CODES.UNAUTHORIZED).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Destructure request body – ADD incidentDate and incidentTime
      const {
        firstName,
        middleName,
        lastName,
        age,
        biologicalSex,
        identifiedAs,
        civilStatus,
        mobileNumber,
        landLineNumber,
        presentAddress,
        permanentAddress,
        classification,
        college,
        department,
        complainedFullName,
        complainedSex,
        complainedClassification,
        complainedCollege,
        complainedDepartment,
        victimConstituent,
        complainedConstituent,
        complainedInsideCampus,
        complainedExactLocation,
        complainantStory,
        complainedIncidentHappened,
        complainedPhysicalAppearance,
        procedureType,
        remarks,
        whereDidYouHearAboutUs,
        otherWhereDidYouHearAboutUs,
        applicableLaws,
        predictedOffense,
        predictedOffenseConfidence,
        predictedSeverity,
        predictedSeverityConfidence,
        incidentDate,
        incidentTime
      } = req.body;

      // Define required fields with display names – ADD incidentDate and incidentTime
      const requiredFields = {
        firstName: "First Name",
        middleName: "Middle Name",
        lastName: "Last Name",
        age: "Age",
        biologicalSex: "Biological Sex",
        identifiedAs: "Identified As",
        civilStatus: "Civil Status",
        mobileNumber: "Mobile Number",
        presentAddress: "Present Address",
        permanentAddress: "Permanent Address",
        classification: "Classification",
        college: "College",
        department: "Department",
        complainedFullName: "Complained Full Name",
        complainedSex: "Complained Sex",
        complainedClassification: "Complained Classification",
        victimConstituent: "Victim Constituent",
        complainedConstituent: "Complained Constituent",
        complainedInsideCampus: "Complained Inside Campus",
        complainedExactLocation: "Complained Exact Location",
        complainantStory: "Complainant Story",
        complainedIncidentHappened: "Incident Happened",
        complainedPhysicalAppearance: "Physical Appearance",
        procedureType: "Procedure Type",
        whereDidYouHearAboutUs: "Where Did You Hear About Us",
        applicableLaws: "Applicable Law",
        predictedOffense: "Offense",
        predictedOffenseConfidence: "Offense Confidence",
        predictedSeverity: "Severity",
        predictedSeverityConfidence: "Severity Confidence",
        incidentDate: "Incident Date",      // NEW
        incidentTime: "Incident Time"       // NEW
      };

      // Check for missing required fields one at a time
      for (const [field, displayName] of Object.entries(requiredFields)) {
        if (!req.body[field]) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: `${displayName} is required`
          });
        }
      }

      // Validate firstName, middleName, and lastName
      const nameRegex = /^[A-Za-z\s\-']+$/;
      const nameFields = ['First name', 'Middle name', 'Last name'];
      const nameValues = [firstName, middleName, lastName];

      for (let i = 0; i < nameFields.length; i++) {
        const trimmed = nameValues[i]?.trim();
        
        if (!trimmed || !nameRegex.test(trimmed)) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: `${nameFields[i]} can only contain letters, spaces, hyphens, and apostrophes`
          });
        }
        
        if (trimmed.length > 50) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: `${nameFields[i]} must not exceed 50 characters`
          });
        }
      }

      // Validate age
      if (isNaN(age) || age < 0 || age > 120) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Age must be a valid number between 0 and 120'
        });
      }

      // Validate biologicalSex
      const validBiologicalSexes = ['Male', 'Female', 'Other'];
      if (!validBiologicalSexes.includes(biologicalSex)) {  
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Biological Sex. Must be Male, Female, or Other'
        });
      }

      // Validate identifiedAs
      const validIdentifiedAs = ['Male', 'Female', 'Non-binary', 'Other'];
      if (!validIdentifiedAs.includes(identifiedAs)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: `Invalid Identity. Must be Male, Female, Non-binary, or Other`
        });
      }

      // Validate civilStatus
      const validCivilStatuses = ['Single', 'Married', 'Divorced', 'Widowed'];
      if (!validCivilStatuses.includes(civilStatus)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Civil Status. Must be Single, Married, Divorced, or Widowed'
        });
      }

      // Validate mobileNumber (required)
      const mobileNumberRegex = /^\d{10,15}$/;
      if (!mobileNumberRegex.test(mobileNumber)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Mobile Number must be between 10 and 15 digits'
        });
      }

      // Validate landlineNumber (optional)
      if (landLineNumber && landLineNumber.trim() !== '') {
        const landlineRegex = /^\d{7,12}$/;
        if (!landlineRegex.test(landLineNumber)) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: 'Landline Number must be between 7 and 12 digits'
          });
        }
      }

      // Validate presentAddress and permanentAddress
      const addressFields = [
        { value: presentAddress, name: 'Present Address' },
        { value: permanentAddress, name: 'Permanent Address' }
      ];

      for (const field of addressFields) {
        if (field.value && field.value.length > 200) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: `${field.name} must not exceed 200 characters`
          });
        }
      }

      // Validate classification
      const validClassifications = ['Student', 'Professor', 'Instructor', 'Teacher', `Gov't Employee`, 'Stranger'];
      if (!validClassifications.includes(classification)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Classification.'
        });
      }

      // Validate college (max length)
      if (college && college.length > 100) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'College must not exceed 100 characters'
        });
      }

      // Validate department (max length)
      if (department && department.length > 100) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Department must not exceed 100 characters'
        });
      }

      // Validate complainedFullName
      if (!nameRegex.test(complainedFullName.trim()) || complainedFullName.trim().length > 100) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Complained Full Name can only contain letters, spaces, hyphens, apostrophes, and must not exceed 100 characters'
        });
      }

      // Validate complainedSex
      const validSexes = ['Male', 'Female', 'Other'];
      if (!validSexes.includes(complainedSex)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Complained Sex. Must be Male, Female, or Other'
        });
      }

      // Validate complainedClassification
      const validComplainedClassifications = ['Student', 'Professor', 'Instructor', 'Teacher', `Gov't Employee`, 'Stranger', 'Co-worker', 'Colleague'];
      if (!validComplainedClassifications.includes(complainedClassification)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Complained Classification.'
        });
      }

      // Validate complainedCollege (max length)
      if (complainedCollege && complainedCollege.length > 100) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Complained College must not exceed 100 characters'
        });
      }

      // Validate complainedDepartment (max length)
      if (complainedDepartment && complainedDepartment.length > 100) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Complained Department must not exceed 100 characters'
        });
      }

      // Validate victimConstituent
      const validVictimConstituent = ['Yes', 'No'];
      if (!validVictimConstituent.includes(victimConstituent)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Constituent'
        });
      }

      // Validate complainedConstituent
      const validConstituent = ['Yes', 'No'];
      if (!validConstituent.includes(complainedConstituent)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Complained Constituent.'
        });
      }

      // Validate complainedInsideCampus
      const validInsideCampus = ['Inside the campus', 'Outside the campus, but UPLB activity', 'Outside the campus and not UPLB activity'];
      if (!validInsideCampus.includes(complainedInsideCampus)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Complained Inside Campus.'
        });
      }

      // Validate complainedExactLocation (optional, max length)
      if (complainedExactLocation && complainedExactLocation.length > 200) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Complained Exact Location must not exceed 200 characters'
        });
      }

      // Validate complainantStory
      if (!complainantStory || complainantStory.trim().length === 0) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Complainant Story is required'
        });
      }
      if (complainantStory.length > 5000) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Complainant Story must not exceed 5000 characters'
        });
      }

      // Validate complainedIncidentHappened
      if (!complainedIncidentHappened || complainedIncidentHappened.trim().length === 0) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Incident Happened is required'
        });
      }
      if (complainedIncidentHappened.length > 1000) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Incident Happened must not exceed 1000 characters'
        });
      }

      // Validate complainedPhysicalAppearance
      if (!complainedPhysicalAppearance || complainedPhysicalAppearance.trim().length === 0) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Physical Appearance is required'
        });
      }
      if (complainedPhysicalAppearance.length > 500) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Physical Appearance must not exceed 500 characters'
        });
      }

      // Validate procedureType
      const validProcedureTypes = ['Formal procedure', 'Informal procedure', 'Undecided / need guidance'];
      if (!validProcedureTypes.includes(procedureType)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid Procedure Type. Must be Formal procedure, Informal procedure, or Undecided / need guidance'
        });
      }

      // Validate remarks (optional)
      if (remarks && remarks.length > 1000) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Remarks must not exceed 1000 characters'
        });
      }

      // Validate whereDidYouHearAboutUs
      const validHearAboutUs = ['Student orientation', 'Flyers / leaflets / ads', 'Word of mouth', 'Social media', 'OASH caravan', 'Others:'];
      if (!validHearAboutUs.includes(whereDidYouHearAboutUs)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid selection for Where Did You Hear About Us'
        });
      }

      // Validate otherWhereDidYouHearAboutUs (required if "Others:" is selected)
      if (whereDidYouHearAboutUs === 'Others:' && (!otherWhereDidYouHearAboutUs || otherWhereDidYouHearAboutUs.trim() === '')) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Please specify where you heard about us'
        });
      }
      
      if (otherWhereDidYouHearAboutUs && otherWhereDidYouHearAboutUs.length > 100) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Other source must not exceed 100 characters'
        });
      }

      // NEW: Validate incidentDate (format YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(incidentDate)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Incident Date must be in YYYY-MM-DD format'
        });
      }
      const parsedDate = new Date(incidentDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Incident Date is not a valid date'
        });
      }

      // NEW: Validate incidentTime (format HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(incidentTime)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Incident Time must be in HH:MM format'
        });
      }

      console.log('🔵 [2] After validation - incidentDate:', incidentDate);
      console.log('🔵 [2] After validation - incidentTime:', incidentTime);

      // Check existing reports and get sanction recommendation
      let sanctionResult = null;
      try {
        const existingReports = await ReportModel.getCountWithSanction(
          complainedFullName.trim(),
          predictedSeverity,
          complainedClassification
        );
        
        sanctionResult = {
          reportCount: existingReports.count,
          recommendedSanction: existingReports.sanction,
          isRepeatOffender: existingReports.count > 0,
          offenseLevel: existingReports.count === 0 ? 'First offense' : 
                        existingReports.count === 1 ? 'Second offense' : 
                        existingReports.count === 2 ? 'Third offense' : 'Multiple offenses'
        };
        
        // Log for monitoring
        console.log(`Sanction check for ${complainedFullName}:`, {
          reportCount: existingReports.count,
          severity: predictedSeverity,
          classification: complainedClassification,
          sanction: existingReports.sanction
        });
        
      } catch (sanctionError) {
        console.error('Error checking existing reports:', sanctionError);
        // Continue with report creation even if sanction check fails
      }

      // Create report ID using uuid
      const reportId = uuidv4();

      // Prepare report data for insertion – ADD incidentDate and incidentTime
      const reportData = {
        reportId: reportId,
        userId: userId,
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        age: parseInt(age),
        biologicalSex: biologicalSex,
        identifiedAs: identifiedAs,
        civilStatus: civilStatus,
        mobileNumber: mobileNumber,
        landLineNumber: landLineNumber || null,
        presentAddress: presentAddress.trim(),
        permanentAddress: permanentAddress.trim(),
        classification: classification,
        college: college.trim(),
        department: department.trim(),
        complainedFullName: complainedFullName.trim(),
        complainedSex: complainedSex,
        complainedClassification: complainedClassification,
        complainedCollege: complainedCollege.trim(),
        complainedDepartment: complainedDepartment.trim(),
        victimConstituent: victimConstituent.trim(),
        complainedConstituent: complainedConstituent.trim(),
        complainedInsideCampus: complainedInsideCampus.trim(),
        complainedExactLocation: complainedExactLocation.trim(),
        complainantStory: complainantStory.trim(),
        complainedIncidentHappened: complainedIncidentHappened.trim(),
        complainedPhysicalAppearance: complainedPhysicalAppearance.trim(),
        procedureType: procedureType,
        remarks: remarks || null,
        whereDidYouHearAboutUs: whereDidYouHearAboutUs,
        otherWhereDidYouHearAboutUs: otherWhereDidYouHearAboutUs || null,
        applicableLaws: Array.isArray(applicableLaws) 
          ? applicableLaws.join(', ') 
          : (applicableLaws ? applicableLaws.trim() : ''),
        predictedOffense: predictedOffense || null,
        predictedOffenseConfidence: predictedOffenseConfidence !== undefined ? predictedOffenseConfidence : null,
        predictedSeverity: predictedSeverity || null,
        predictedSeverityConfidence: predictedSeverityConfidence !== undefined ? predictedSeverityConfidence : null,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),

        // Sanctions
        previousReportCount: sanctionResult?.reportCount || 0,
        recommendedSanction: sanctionResult?.recommendedSanction || null,
        isRepeatOffender: sanctionResult?.isRepeatOffender || false,
        offenseLevel: sanctionResult?.offenseLevel || 'First offense',

        // NEW: Incident date and time
        incidentDate: incidentDate,
        incidentTime: incidentTime
      };
      
      console.log('🔵 [3] Before model - incidentDate:', reportData.incidentDate);
      console.log('🔵 [3] Before model - incidentTime:', reportData.incidentTime);

      // Insert report into database
      const insertData = await ReportModel.create(reportData);

      // Check if insertion was successful
      if (!insertData) {
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Something went wrong while creating new report'
        });
      }

      return res.status(STATUS_CODES.CREATED).json({
        success: true,
        message: 'Report created successfully'
      });

    } catch (error) {
      console.error('Error creating report:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to create report'
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
      const classification = req.query.classification;
      const procedureType = req.query.procedureType;
      const fromDate = req.query.fromDate;
      const toDate = req.query.toDate;
      const search = req.query.search;

      // Build filter object
      const filters = { userId: userId };

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
  
  async getCount(req, res) {
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

      // Get parameters from query
      const { fullName, severity, classification } = req.query;

      // Validate required parameters
      if (!fullName) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Please provide fullName parameter'
        });
      }

      if (!severity) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Please provide severity parameter'
        });
      }

      if (!classification) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Please provide classification parameter'
        });
      }

      // Validate severity values
      const validSeverities = ['Grave', 'Less Grave', 'Light', 'None'];
      if (!validSeverities.includes(severity)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid severity. Must be Grave, Less Grave, Light, or None'
        });
      }

      // Validate classification values
      const validClassifications = ['Student', 'Professor', 'Instructor', 'Teacher', `Gov't Employee`, 'Stranger', 'Co-worker', 'Colleague'];
      if (!validClassifications.includes(classification)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid classification'
        });
      }

      // Call the model to get the count and determine sanction
      const result = await ReportModel.getCountWithSanction(
        fullName.trim(),
        severity,
        classification
      );

      return res.status(STATUS_CODES.OK).json({
        success: true,
        data: {
          fullName: fullName.trim(),
          severity: severity,
          classification: classification,
          reportCount: result.count,
          sanction: result.sanction
        }
      });

    } catch (error) {
      console.error('Error fetching report count:', error);
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to fetch report count'
      });
    }
  }
}

module.exports = new ReportController();