export interface DriverInvitationCreatedResponse {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role?: string;
  status?: string;
  organizationId?: string;
  organizationName?: string;
}

export interface DriverInvitationDetails {
  id: string;
  fullName: string;
  email: string;
  role: string;
  organizationName: string;
  organizationId: string;
  status: string;
  expiresAt: string;
}

export interface DriverInvitationAcceptanceResponse {
  userId: string;
  message: string;
}
