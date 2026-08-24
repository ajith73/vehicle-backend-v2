import { QueryInterface, DataTypes } from 'sequelize';

type Migration = {
  name: string;
  up: (queryInterface: QueryInterface) => Promise<void>;
};

const tableExists = async (queryInterface: QueryInterface, tableName: string) => {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    if (typeof table === 'string') return table === tableName;
    return (table as { tableName?: string }).tableName === tableName;
  });
};

const createTableIfMissing = async (
  queryInterface: QueryInterface,
  tableName: string,
  attributes: Parameters<QueryInterface['createTable']>[1]
) => {
  if (await tableExists(queryInterface, tableName)) {
    return;
  }

  await queryInterface.createTable(tableName, attributes);
};

const timestamps = {
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
};

const initialSchemaMigration: Migration = {
  name: '001-initial-schema',
  up: async (queryInterface) => {
    await createTableIfMissing(queryInterface, 'Roles', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'Users', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: true },
      username: { type: DataTypes.STRING, allowNull: false, unique: true },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      refreshToken: { type: DataTypes.STRING, allowNull: true },
      allowedScreens: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
      roleId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'Feedbacks', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'New' },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'Donations', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      amount: { type: DataTypes.FLOAT, allowNull: false },
      paymentReference: { type: DataTypes.STRING, allowNull: true },
      name: { type: DataTypes.STRING, allowNull: true },
      email: { type: DataTypes.STRING, allowNull: true },
      consentGiven: { type: DataTypes.BOOLEAN, defaultValue: false },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'VehicleTypes', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      isFeatured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'ServiceTypes', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      isFeatured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'Mechanics', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      mechanicType: {
        type: DataTypes.ENUM('Individual Mechanic', 'Workshop / Garage', 'Authorized Service Center', 'Mobile Mechanic', 'Towing Company', 'Fuel Delivery Partner'),
        allowNull: false,
        defaultValue: 'Workshop / Garage'
      },
      name: { type: DataTypes.STRING, allowNull: true },
      businessName: { type: DataTypes.STRING, allowNull: true },
      mechanicName: { type: DataTypes.STRING, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      phone: { type: DataTypes.JSON, allowNull: false },
      emails: { type: DataTypes.JSON, allowNull: true },
      categories: { type: DataTypes.JSON, allowNull: true },
      categoryName: { type: DataTypes.TEXT, allowNull: true },
      vehicleTypes: { type: DataTypes.JSON, allowNull: false },
      serviceTypes: { type: DataTypes.JSON, allowNull: false },
      serviceRadius: { type: DataTypes.INTEGER, allowNull: true },
      evSupport: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      homeService: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      roadsideAssistance: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is24Hours: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      holidayWorking: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      latitude: { type: DataTypes.FLOAT, allowNull: false },
      longitude: { type: DataTypes.FLOAT, allowNull: false },
      address: { type: DataTypes.TEXT, allowNull: false },
      landmark: { type: DataTypes.STRING, allowNull: true },
      area: { type: DataTypes.STRING, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: true },
      state: { type: DataTypes.STRING, allowNull: true },
      country: { type: DataTypes.STRING, allowNull: true },
      operatingDays: { type: DataTypes.JSON, allowNull: true },
      operatingHours: { type: DataTypes.STRING, allowNull: true },
      availability: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      image: { type: DataTypes.TEXT, allowNull: true },
      websiteUrl: { type: DataTypes.TEXT, allowNull: true },
      googlePlaceId: { type: DataTypes.STRING, allowNull: true },
      rating: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM('Pending', 'Approved', 'Rejected', 'Inactive'),
        allowNull: false,
        defaultValue: 'Pending'
      },
      createdById: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      approvedById: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'MechanicUpdateRequests', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      updatedData: { type: DataTypes.JSON, allowNull: false },
      status: {
        type: DataTypes.ENUM('Pending Update Approval', 'Approved', 'Rejected'),
        allowNull: false,
        defaultValue: 'Pending Update Approval'
      },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      requestedById: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      reviewedById: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'ActivityLogs', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      action: { type: DataTypes.STRING, allowNull: false },
      details: { type: DataTypes.TEXT, allowNull: true },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      ...timestamps
    });
  }
};

const addPincodeMigration: Migration = {
  name: '002-add-pincode',
  up: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('Mechanics');
    if (!tableDesc.pincode) {
      await queryInterface.addColumn('Mechanics', 'pincode', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
    if (tableDesc.area) {
      await queryInterface.removeColumn('Mechanics', 'area');
    }
  }
};

const addUserNameMigration: Migration = {
  name: '003-add-user-name',
  up: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('Users');
    if (!tableDesc.name) {
      await queryInterface.addColumn('Users', 'name', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
  }
};

const allowNullMechanicIdOnUpdateRequestsMigration: Migration = {
  name: '004-allow-null-mechanic-update-request-mechanic-id',
  up: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('MechanicUpdateRequests');
    if (tableDesc.mechanicId?.allowNull === false) {
      await queryInterface.changeColumn('MechanicUpdateRequests', 'mechanicId', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
    }
  }
};

const addDonationFieldsMigration: Migration = {
  name: '005-add-donation-fields',
  up: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('Donations');
    if (!tableDesc.email) {
      await queryInterface.addColumn('Donations', 'email', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
    if (!tableDesc.consentGiven) {
      await queryInterface.addColumn('Donations', 'consentGiven', {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      });
    }
  }
};

const addMechanicRemarksMigration: Migration = {
  name: '006-add-mechanic-remarks',
  up: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('Mechanics');
    if (!tableDesc.remarks) {
      await queryInterface.addColumn('Mechanics', 'remarks', {
        type: DataTypes.TEXT,
        allowNull: true,
      });
    }
  }
};

const addMechanicUpdateRequestRemarksMigration: Migration = {
  name: '007-add-mechanic-update-request-remarks',
  up: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('MechanicUpdateRequests');
    if (!tableDesc.remarks) {
      await queryInterface.addColumn('MechanicUpdateRequests', 'remarks', {
        type: DataTypes.TEXT,
        allowNull: true,
      });
    }
  }
};

const addUserDeletedAtMigration: Migration = {
  name: '008-add-user-deleted-at',
  up: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('Users');
    if (!tableDesc.deletedAt) {
      await queryInterface.addColumn('Users', 'deletedAt', {
        type: DataTypes.DATE,
        allowNull: true,
      });
    }
  }
};

const addGooglePlaceIdMigration: Migration = {
  name: '009-add-google-place-id',
  up: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('Mechanics');
    if (!tableDesc.googlePlaceId) {
      await queryInterface.addColumn('Mechanics', 'googlePlaceId', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
  }
};

const addVerificationFieldsMigration: Migration = {
  name: '010-add-verification-fields',
  up: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('Mechanics');
    if (!tableDesc.verificationLevel) {
      await queryInterface.addColumn('Mechanics', 'verificationLevel', {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      });
    }
    if (!tableDesc.verificationChecklist) {
      await queryInterface.addColumn('Mechanics', 'verificationChecklist', {
        type: DataTypes.JSON,
        defaultValue: {},
      });
    }
    if (!tableDesc.shopPhotosLink) {
      await queryInterface.addColumn('Mechanics', 'shopPhotosLink', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
    if (!tableDesc.ownerIdentityLink) {
      await queryInterface.addColumn('Mechanics', 'ownerIdentityLink', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
    if (!tableDesc.priceListLink) {
      await queryInterface.addColumn('Mechanics', 'priceListLink', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
  }
};

const addVerificationRequestsTableMigration: Migration = {
  name: '011-add-verification-requests-table',
  up: async (queryInterface) => {
    await createTableIfMissing(queryInterface, 'VerificationRequests', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      shopPhotosLink: { type: DataTypes.STRING, allowNull: false },
      ownerIdentityLink: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
        allowNull: false,
        defaultValue: 'Pending'
      },
      remarks: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
  }
};

const updateVerificationRequestsSchemaMigration: Migration = {
  name: '012-update-verification-requests-schema',
  up: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('VerificationRequests').catch(() => null);
    if (tableDesc) {
      if (!tableDesc.submittedData) {
        await queryInterface.addColumn('VerificationRequests', 'submittedData', {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: {}
        });
      }
      if (tableDesc.shopPhotosLink && tableDesc.shopPhotosLink.allowNull === false) {
        await queryInterface.changeColumn('VerificationRequests', 'shopPhotosLink', {
          type: DataTypes.STRING,
          allowNull: true
        });
      }
      if (tableDesc.ownerIdentityLink && tableDesc.ownerIdentityLink.allowNull === false) {
        await queryInterface.changeColumn('VerificationRequests', 'ownerIdentityLink', {
          type: DataTypes.STRING,
          allowNull: true
        });
      }
    }
  }
};

const createOtpsTableMigration: Migration = {
  name: '013-create-otps-table',
  up: async (queryInterface) => {
    await createTableIfMissing(queryInterface, 'Otps', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false },
      code: { type: DataTypes.STRING, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      ...timestamps
    });
  }
};

const createSpecificServicesTableMigration: Migration = {
  name: '014-create-specific-services-table',
  up: async (queryInterface) => {
    await createTableIfMissing(queryInterface, 'SpecificServices', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      isFeatured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps
    });
  }
};

const createReviewsTableMigration: Migration = {
  name: '015-create-reviews-table',
  up: async (queryInterface) => {
    await createTableIfMissing(queryInterface, 'Reviews', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false },
      visitorId: { type: DataTypes.STRING, allowNull: false },
      fingerprint: { type: DataTypes.STRING, allowNull: false },
      ratingTimeliness: { type: DataTypes.INTEGER, allowNull: false },
      ratingFairness: { type: DataTypes.INTEGER, allowNull: false },
      ratingRecommendation: { type: DataTypes.INTEGER, allowNull: false },
      isProblemFixed: { type: DataTypes.BOOLEAN, allowNull: false },
      comments: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'), defaultValue: 'Pending' },
      ...timestamps
    });
  }
};

const createCustomerPhaseOneTablesMigration: Migration = {
  name: '016-create-customer-phase-one-tables',
  up: async (queryInterface) => {
    await createTableIfMissing(queryInterface, 'CustomerProfiles', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      displayName: { type: DataTypes.STRING, allowNull: true },
      phone: { type: DataTypes.STRING, allowNull: true },
      lastLoginAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'CustomerRequests', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      serviceTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'ServiceTypes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      specificServiceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'SpecificServices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      vehicleTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'VehicleTypes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      vehicleLabel: { type: DataTypes.STRING, allowNull: true },
      issueSummary: { type: DataTypes.STRING, allowNull: false },
      issueDetails: { type: DataTypes.TEXT, allowNull: true },
      latitude: { type: DataTypes.FLOAT, allowNull: false },
      longitude: { type: DataTypes.FLOAT, allowNull: false },
      addressText: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'SUBMITTED'
      },
      adminNotes: { type: DataTypes.TEXT, allowNull: true },
      statusUpdatedAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps
    });
  }
};

const createPhaseTwoOperationsTablesMigration: Migration = {
  name: '017-create-phase-two-operations-tables',
  up: async (queryInterface) => {
    const mechanicTableDesc = await queryInterface.describeTable('Mechanics');
    if (!mechanicTableDesc.isOnline) {
      await queryInterface.addColumn('Mechanics', 'isOnline', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!mechanicTableDesc.availabilityState) {
      await queryInterface.addColumn('Mechanics', 'availabilityState', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
    if (!mechanicTableDesc.lastActiveAt) {
      await queryInterface.addColumn('Mechanics', 'lastActiveAt', {
        type: DataTypes.DATE,
        allowNull: true,
      });
    }

    const customerRequestTableDesc = await queryInterface.describeTable('CustomerRequests');
    if (customerRequestTableDesc.status?.type?.toLowerCase().includes('enum')) {
      await queryInterface.changeColumn('CustomerRequests', 'status', {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'SUBMITTED'
      });
    }
    if (!customerRequestTableDesc.statusUpdatedAt) {
      await queryInterface.addColumn('CustomerRequests', 'statusUpdatedAt', {
        type: DataTypes.DATE,
        allowNull: true,
      });
    }

    await createTableIfMissing(queryInterface, 'RequestAssignments', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerRequestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      assignedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ASSIGNED' },
      notes: { type: DataTypes.TEXT, allowNull: true },
      respondedAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'RequestTimelineEvents', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerRequestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      eventType: { type: DataTypes.STRING, allowNull: false },
      fromStatus: { type: DataTypes.STRING, allowNull: true },
      toStatus: { type: DataTypes.STRING, allowNull: true },
      actorType: { type: DataTypes.STRING, allowNull: false },
      actorUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true, defaultValue: {} },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'RequestCancellations', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerRequestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      cancelledByType: { type: DataTypes.STRING, allowNull: false },
      cancelledByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      reason: { type: DataTypes.STRING, allowNull: false },
      details: { type: DataTypes.TEXT, allowNull: true },
      ...timestamps
    });
  }
};

const createPhaseThreeLifecycleTablesMigration: Migration = {
  name: '018-create-phase-three-lifecycle-tables',
  up: async (queryInterface) => {
    const customerRequestTableDesc = await queryInterface.describeTable('CustomerRequests');
    const timestampColumns = [
      'acceptedAt',
      'enRouteAt',
      'arrivedAt',
      'serviceStartedAt',
      'completedAt'
    ] as const;

    for (const column of timestampColumns) {
      if (!customerRequestTableDesc[column]) {
        await queryInterface.addColumn('CustomerRequests', column, {
          type: DataTypes.DATE,
          allowNull: true,
        });
      }
    }

    await createTableIfMissing(queryInterface, 'RequestProofAssets', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerRequestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      uploadedByType: { type: DataTypes.STRING, allowNull: false },
      uploadedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      assetType: { type: DataTypes.STRING, allowNull: false },
      assetUrl: { type: DataTypes.TEXT, allowNull: false },
      caption: { type: DataTypes.TEXT, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'RequestInternalNotes', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerRequestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      authorUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      note: { type: DataTypes.TEXT, allowNull: false },
      ...timestamps
    });
  }
};

const createPhaseFourCommercialTablesMigration: Migration = {
  name: '019-create-phase-four-commercial-tables',
  up: async (queryInterface) => {
    const customerRequestTableDesc = await queryInterface.describeTable('CustomerRequests');
    const additiveColumns = [
      ['pricingMode', DataTypes.STRING],
      ['quoteStatus', DataTypes.STRING],
      ['paymentStatus', DataTypes.STRING],
      ['finalAmount', DataTypes.FLOAT]
    ] as const;

    for (const [column, type] of additiveColumns) {
      if (!customerRequestTableDesc[column]) {
        await queryInterface.addColumn('CustomerRequests', column, {
          type,
          allowNull: true,
        });
      }
    }

    await createTableIfMissing(queryInterface, 'RequestQuotes', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerRequestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'QUOTE_PENDING' },
      pricingMode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'QUOTE_REQUIRED' },
      currencyCode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'INR' },
      subtotalAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      taxAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      feeAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      totalAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      notes: { type: DataTypes.TEXT, allowNull: true },
      customerDecisionNotes: { type: DataTypes.TEXT, allowNull: true },
      submittedAt: { type: DataTypes.DATE, allowNull: true },
      approvedAt: { type: DataTypes.DATE, allowNull: true },
      rejectedAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'RequestQuoteLineItems', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      requestQuoteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'RequestQuotes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      label: { type: DataTypes.STRING, allowNull: false },
      category: { type: DataTypes.STRING, allowNull: false, defaultValue: 'LABOR' },
      quantity: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1 },
      unitAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      totalAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      description: { type: DataTypes.TEXT, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'PaymentTransactions', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerRequestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      requestQuoteId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'RequestQuotes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      paymentStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: 'PAYMENT_PENDING' },
      provider: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ROADRESQ_MANUAL_READY' },
      paymentMethod: { type: DataTypes.STRING, allowNull: true },
      amount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      currencyCode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'INR' },
      transactionReference: { type: DataTypes.STRING, allowNull: true },
      gatewayPayload: { type: DataTypes.JSONB, allowNull: true },
      paidAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps
    });
  }
};

const createPhaseFiveMembershipAndTrustTablesMigration: Migration = {
  name: '020-create-phase-five-membership-and-trust-tables',
  up: async (queryInterface) => {
    const mechanicTableDesc = await queryInterface.describeTable('Mechanics');
    const mechanicColumns = [
      ['isTrustedPartner', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }],
      ['partnerTier', { type: DataTypes.STRING, allowNull: true }],
      ['trustScore', { type: DataTypes.FLOAT, allowNull: true }],
      ['priorityDispatchEligible', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }],
    ] as const;

    for (const [column, definition] of mechanicColumns) {
      if (!mechanicTableDesc[column]) {
        await queryInterface.addColumn('Mechanics', column, definition);
      }
    }

    const customerProfileTableDesc = await queryInterface.describeTable('CustomerProfiles');
    const customerProfileColumns = [
      ['subscriptionStatus', { type: DataTypes.STRING, allowNull: true }],
      ['subscriptionTier', { type: DataTypes.STRING, allowNull: true }],
      ['subscriptionEndsAt', { type: DataTypes.DATE, allowNull: true }],
      ['prioritySupportEligible', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }],
    ] as const;

    for (const [column, definition] of customerProfileColumns) {
      if (!customerProfileTableDesc[column]) {
        await queryInterface.addColumn('CustomerProfiles', column, definition);
      }
    }

    await createTableIfMissing(queryInterface, 'SubscriptionPlans', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      tier: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MEMBER' },
      description: { type: DataTypes.TEXT, allowNull: true },
      priceAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      billingCycle: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MONTHLY' },
      platformFeeDiscountPercent: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      prioritySupport: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      priorityDispatch: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      trustedOnlyAccess: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'CustomerSubscriptions', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      subscriptionPlanId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'SubscriptionPlans', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ACTIVE' },
      subscriptionTier: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MEMBER' },
      priceAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      startsAt: { type: DataTypes.DATE, allowNull: false },
      endsAt: { type: DataTypes.DATE, allowNull: false },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'TrustedPartnerAudits', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      changedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      isTrustedPartner: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      partnerTier: { type: DataTypes.STRING, allowNull: true },
      trustScore: { type: DataTypes.FLOAT, allowNull: true },
      reason: { type: DataTypes.TEXT, allowNull: true },
      ...timestamps
    });
  }
};

const createPhaseSixRealtimeOpsTablesMigration: Migration = {
  name: '021-create-phase-six-realtime-ops-tables',
  up: async (queryInterface) => {
    const customerRequestTableDesc = await queryInterface.describeTable('CustomerRequests');
    const requestColumns = [
      ['currentEtaMinutes', { type: DataTypes.INTEGER, allowNull: true }],
      ['dispatchStatus', { type: DataTypes.STRING, allowNull: true }],
      ['lastDispatchAt', { type: DataTypes.DATE, allowNull: true }],
      ['lastLocationUpdateAt', { type: DataTypes.DATE, allowNull: true }],
    ] as const;

    for (const [column, definition] of requestColumns) {
      if (!customerRequestTableDesc[column]) {
        await queryInterface.addColumn('CustomerRequests', column, definition);
      }
    }

    await createTableIfMissing(queryInterface, 'MechanicLiveStates', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      isOnline: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      availabilityState: { type: DataTypes.STRING, allowNull: false, defaultValue: 'OFFLINE' },
      latitude: { type: DataTypes.FLOAT, allowNull: true },
      longitude: { type: DataTypes.FLOAT, allowNull: true },
      heading: { type: DataTypes.FLOAT, allowNull: true },
      accuracyMeters: { type: DataTypes.FLOAT, allowNull: true },
      lastLocationUpdateAt: { type: DataTypes.DATE, allowNull: true },
      staleAfterAt: { type: DataTypes.DATE, allowNull: true },
      activeRequestId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'RequestDispatchAttempts', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerRequestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      dispatchMode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MANUAL' },
      attemptStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: 'DISPATCHING' },
      notes: { type: DataTypes.TEXT, allowNull: true },
      responseAt: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'DispatchOverrides', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerRequestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      overriddenByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      overrideType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MANUAL_REASSIGN' },
      reason: { type: DataTypes.TEXT, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'SupportTickets', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerRequestId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      raisedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      assignedToUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      source: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ADMIN' },
      ticketType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'LIVE_SUPPORT' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'OPEN' },
      priority: { type: DataTypes.STRING, allowNull: false, defaultValue: 'NORMAL' },
      subject: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'RealtimeEventLogs', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerRequestId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      actorUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      channel: { type: DataTypes.STRING, allowNull: false, defaultValue: 'OPS' },
      eventType: { type: DataTypes.STRING, allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });
  }
};

const createPhaseSevenAnalyticsTablesMigration: Migration = {
  name: '022-create-phase-seven-analytics-tables',
  up: async (queryInterface) => {
    await createTableIfMissing(queryInterface, 'AnalyticsEvents', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      eventType: { type: DataTypes.STRING, allowNull: false },
      actorType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'SYSTEM' },
      customerRequestId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      city: { type: DataTypes.STRING, allowNull: true },
      zoneKey: { type: DataTypes.STRING, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      occurredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'PartnerPerformanceMetrics', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      metricDate: { type: DataTypes.DATEONLY, allowNull: false },
      onlineHours: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      dispatchAttemptsReceived: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      acceptRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      rejectRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      timeoutRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      completionRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      quoteApprovalRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      paymentLinkedCompletionRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      averageEtaMinutes: { type: DataTypes.FLOAT, allowNull: true },
      score: { type: DataTypes.FLOAT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'MarketplaceZoneMetrics', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      zoneKey: { type: DataTypes.STRING, allowNull: false },
      city: { type: DataTypes.STRING, allowNull: true },
      metricDate: { type: DataTypes.DATEONLY, allowNull: false },
      requestCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      assignedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      completedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      noSupplyCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      cancellationCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      activeSupplyCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      averageEtaMinutes: { type: DataTypes.FLOAT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'DispatchScoreSnapshots', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      customerRequestId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'CustomerRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      mechanicId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Mechanics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      scoreType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MATCH_SCORE' },
      score: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      factors: { type: DataTypes.JSONB, allowNull: true },
      rules: { type: DataTypes.JSONB, allowNull: true },
      isActiveRuleSet: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'CustomerFunnelSnapshots', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      metricDate: { type: DataTypes.DATEONLY, allowNull: false },
      city: { type: DataTypes.STRING, allowNull: true },
      requestStarted: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      requestSubmitted: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      requestAssigned: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      requestAccepted: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      serviceStarted: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      serviceCompleted: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      quoteApproved: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      paymentRecorded: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      repeatRequestCreated: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });
  }
};

const createPhaseEightRegionalScaleTablesMigration: Migration = {
  name: '023-create-phase-eight-regional-scale-tables',
  up: async (queryInterface) => {
    await createTableIfMissing(queryInterface, 'CityConfigs', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      cityName: { type: DataTypes.STRING, allowNull: false },
      slug: { type: DataTypes.STRING, allowNull: false, unique: true },
      stateName: { type: DataTypes.STRING, allowNull: true },
      countryName: { type: DataTypes.STRING, allowNull: false, defaultValue: 'India' },
      launchState: { type: DataTypes.STRING, allowNull: false, defaultValue: 'PLANNED' },
      cityTier: { type: DataTypes.STRING, allowNull: true },
      defaultLanguage: { type: DataTypes.STRING, allowNull: true },
      membershipBenefitsEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      trustedSupplyThreshold: { type: DataTypes.INTEGER, allowNull: true },
      rapidResponseEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      seoIntro: { type: DataTypes.TEXT, allowNull: true },
      operationalNotes: { type: DataTypes.TEXT, allowNull: true },
      rules: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'ZoneConfigs', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      cityConfigId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'CityConfigs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      cityName: { type: DataTypes.STRING, allowNull: false },
      zoneName: { type: DataTypes.STRING, allowNull: false },
      slug: { type: DataTypes.STRING, allowNull: false, unique: true },
      launchState: { type: DataTypes.STRING, allowNull: false, defaultValue: 'PLANNED' },
      rapidResponseEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      standbySupplyTarget: { type: DataTypes.INTEGER, allowNull: true },
      etaExpectationMinutes: { type: DataTypes.INTEGER, allowNull: true },
      pricingMultiplier: { type: DataTypes.FLOAT, allowNull: true },
      serviceAvailabilityMode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'NORMAL' },
      operationalNotes: { type: DataTypes.TEXT, allowNull: true },
      rules: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'ServiceAvailabilityRules', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      serviceTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'ServiceTypes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      cityConfigId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'CityConfigs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      zoneConfigId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'ZoneConfigs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      citySlug: { type: DataTypes.STRING, allowNull: true },
      zoneSlug: { type: DataTypes.STRING, allowNull: true },
      availabilityState: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ENABLED' },
      customerMessage: { type: DataTypes.TEXT, allowNull: true },
      minTrustedPartners: { type: DataTypes.INTEGER, allowNull: true },
      rapidResponseOnly: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      rules: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'RegionalPricingRules', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      cityConfigId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'CityConfigs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      zoneConfigId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'ZoneConfigs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      serviceTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'ServiceTypes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      citySlug: { type: DataTypes.STRING, allowNull: true },
      zoneSlug: { type: DataTypes.STRING, allowNull: true },
      ruleName: { type: DataTypes.STRING, allowNull: false },
      pricingMode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MULTIPLIER' },
      multiplier: { type: DataTypes.FLOAT, allowNull: true },
      flatFee: { type: DataTypes.FLOAT, allowNull: true },
      taxPercent: { type: DataTypes.FLOAT, allowNull: true },
      memberDiscountPercent: { type: DataTypes.FLOAT, allowNull: true },
      rules: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });

    await createTableIfMissing(queryInterface, 'MarketplaceLaunchStates', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      scopeType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'CITY' },
      scopeSlug: { type: DataTypes.STRING, allowNull: false },
      launchState: { type: DataTypes.STRING, allowNull: false, defaultValue: 'PLANNED' },
      effectiveFrom: { type: DataTypes.DATE, allowNull: true },
      effectiveTo: { type: DataTypes.DATE, allowNull: true },
      pauseReason: { type: DataTypes.TEXT, allowNull: true },
      supportMessage: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      ...timestamps
    });
  }
};

const addUserPasswordResetFieldsMigration: Migration = {
  name: '024-add-user-password-reset-fields',
  up: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('Users');

    if (!tableDesc.resetPasswordToken) {
      await queryInterface.addColumn('Users', 'resetPasswordToken', {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (!tableDesc.resetPasswordExpiresAt) {
      await queryInterface.addColumn('Users', 'resetPasswordExpiresAt', {
        type: DataTypes.DATE,
        allowNull: true
      });
    }
  }
};

export const migrations: Migration[] = [
  initialSchemaMigration,
  addPincodeMigration,
  addUserNameMigration,
  allowNullMechanicIdOnUpdateRequestsMigration,
  addDonationFieldsMigration,
  addMechanicRemarksMigration,
  addMechanicUpdateRequestRemarksMigration,
  addUserDeletedAtMigration,
  addGooglePlaceIdMigration,
  addVerificationFieldsMigration,
  addVerificationRequestsTableMigration,
  updateVerificationRequestsSchemaMigration,
  createOtpsTableMigration,
  createSpecificServicesTableMigration,
  createReviewsTableMigration,
  createCustomerPhaseOneTablesMigration,
  createPhaseTwoOperationsTablesMigration,
  createPhaseThreeLifecycleTablesMigration,
  createPhaseFourCommercialTablesMigration,
  createPhaseFiveMembershipAndTrustTablesMigration,
  createPhaseSixRealtimeOpsTablesMigration,
  createPhaseSevenAnalyticsTablesMigration,
  createPhaseEightRegionalScaleTablesMigration,
  addUserPasswordResetFieldsMigration
];

export const addCustomerProfilePictureMigration: Migration = {
  name: 'add-customer-profile-picture',
  up: async (queryInterface) => {
    const tableInfo = await queryInterface.describeTable('CustomerProfiles').catch(() => null);
    if (tableInfo && !tableInfo.profilePicture) {
      await queryInterface.addColumn('CustomerProfiles', 'profilePicture', {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }
  }
};

migrations.push(addCustomerProfilePictureMigration);
