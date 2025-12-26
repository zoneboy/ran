
export enum UserRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum MembershipStatus {
  ACTIVE = 'Active',
  PENDING = 'Pending',
  SUSPENDED = 'Suspended',
  EXPIRED = 'Expired',
}

export enum MembershipCategory {
  CORPORATE = 'Corporate Member',
  PATRON = 'Patron',
  ASSOCIATE = 'Associate Member',
  PROFESSIONAL = 'Professional Member',
  HONORARY = 'Honorary Member',
}

export enum BusinessCategory {
  ADVOCACY = 'Advocacy',
  LASTMILE = 'Lastmile Collector',
  AGGREGATOR = 'Aggregator',
  PROCESSOR = 'Processor',
  MANUFACTURER = 'Manufacturer',
  OTHER = 'Other',
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  status: MembershipStatus;
  category: MembershipCategory;
  gender?: 'Male' | 'Female';
  businessName: string;
  businessAddress: string;
  businessState: string;
  businessCity?: string;
  businessCommencement?: string;
  businessCategory?: string; // String to allow custom "Other" values
  statesOfOperation: string;
  materialTypes: string[];
  machineryDeployed: string[];
  monthlyVolume: string;
  employees: number;
  areasOfInterest?: string[];
  relatedAssociation?: string;
  relatedAssociationName?: string;
  dob?: string;
  dateJoined: string;
  expiryDate: string;
  profileImage?: string;
  // Security fields
  resetToken?: string;
  resetTokenExpiry?: number; // Timestamp
  documents?: {
    cac?: string;
    logo?: string;
    evidence?: string;
    membershipIdCard?: string;
    membershipCertificate?: string;
  };
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  isImportant: boolean;
}

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  status: 'Successful' | 'Pending' | 'Failed';
  reference: string;
  receipt?: string; // Base64 string of the uploaded receipt
}

export interface StatData {
  name: string;
  value: number;
}