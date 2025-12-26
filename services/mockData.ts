import { User, UserRole, MembershipStatus, MembershipCategory, Announcement, Payment } from '../types';

// Helper to get a date relative to today
const getRelativeDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: '1',
    title: 'Annual General Meeting 2024',
    content: 'The AGM is scheduled for October 15th at the Lagos Civic Center. Attendance is mandatory for Corporate members.',
    date: '2024-09-01',
    isImportant: true,
  },
  {
    id: '2',
    title: 'New Policy on PET Recycling',
    content: 'The government has released new guidelines regarding PET bottle collection standards. Please review the document in the resources section.',
    date: '2024-09-10',
    isImportant: false,
  },
  {
    id: '3',
    title: 'Grant Opportunity for Aggregators',
    content: 'Applications are now open for the Green Fund Grant aimed at supporting aggregators to scale their operations.',
    date: '2024-09-12',
    isImportant: true,
  },
];

export const MOCK_USERS: User[] = [
  {
    id: 'admin-1',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@ran.org.ng',
    phone: '08000000000',
    role: UserRole.ADMIN,
    status: MembershipStatus.ACTIVE,
    category: MembershipCategory.HONORARY,
    businessName: 'RAN HQ',
    businessAddress: 'Abuja',
    businessState: 'FCT',
    statesOfOperation: 'All',
    materialTypes: [],
    machineryDeployed: [],
    monthlyVolume: '0',
    employees: 10,
    dateJoined: '2020-01-01',
    expiryDate: '2099-12-31',
    profileImage: 'https://picsum.photos/200/200',
  },
  {
    id: 'user-1',
    firstName: 'Chinedu',
    lastName: 'Okafor',
    email: 'chinedu@ecolife.com',
    phone: '08012345678',
    role: UserRole.MEMBER,
    status: MembershipStatus.ACTIVE,
    category: MembershipCategory.CORPORATE,
    businessName: 'EcoLife Recycling Ltd',
    businessAddress: '15 Ikeja Way, Lagos',
    businessState: 'Lagos',
    statesOfOperation: 'Lagos, Ogun',
    materialTypes: ['PET Plastics', 'Metals'],
    machineryDeployed: ['Baler', 'Crusher'],
    monthlyVolume: '50 Tons',
    employees: 25,
    dateJoined: '2023-05-15',
    expiryDate: getRelativeDate(15), // Expiring in 15 days
    profileImage: 'https://picsum.photos/201/201',
  },
  {
    id: 'user-2',
    firstName: 'Amina',
    lastName: 'Bello',
    email: 'amina@greenearth.ng',
    phone: '08098765432',
    role: UserRole.MEMBER,
    status: MembershipStatus.PENDING,
    category: MembershipCategory.ASSOCIATE,
    businessName: 'Green Earth Solutions',
    businessAddress: 'Kano City',
    businessState: 'Kano',
    statesOfOperation: 'Kano',
    materialTypes: ['Paper', 'Cartons'],
    machineryDeployed: ['None'],
    monthlyVolume: '5 Tons',
    employees: 5,
    dateJoined: '2024-08-20',
    expiryDate: getRelativeDate(365),
  },
  {
    id: 'user-3',
    firstName: 'Tunde',
    lastName: 'Bakare',
    email: 'tunde@metalworks.ng',
    phone: '08055555555',
    role: UserRole.MEMBER,
    status: MembershipStatus.ACTIVE,
    category: MembershipCategory.CORPORATE,
    businessName: 'Lagos Metal Works',
    businessAddress: 'Apapa, Lagos',
    businessState: 'Lagos',
    statesOfOperation: 'Lagos',
    materialTypes: ['Metals', 'UBC'],
    machineryDeployed: ['Crusher'],
    monthlyVolume: '100 Tons',
    employees: 40,
    dateJoined: '2022-01-10',
    expiryDate: getRelativeDate(-5), // Expired 5 days ago
  }
];

export const MOCK_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    userId: 'user-1',
    amount: 100000,
    currency: 'NGN',
    date: '2023-05-15',
    description: 'Corporate Membership Registration',
    status: 'Successful',
    reference: 'REF-123456',
  },
  {
    id: 'pay-2',
    userId: 'user-1',
    amount: 80000,
    currency: 'NGN',
    date: '2024-05-10',
    description: 'Corporate Membership Renewal',
    status: 'Successful',
    reference: 'REF-789012',
  }
];