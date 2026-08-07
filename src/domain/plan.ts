export type PlanIntent = 'food' | 'activity' | 'both';
export type PlanStatus = 'planning' | 'locked';
export type PlanSlot = 'food' | 'activity';
export type ParticipantRole = 'owner' | 'participant';
export type RsvpStatus = 'going' | 'maybe' | 'cant_make_it';
export type TravelMode = 'car' | 'walk' | 'bike' | 'train' | 'plane';

export type PlaceSnapshot = {
  providerId?: string;
  provider: 'google_places' | 'ticketmaster' | 'manual';
  title: string;
  subtitle?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  sourceUrl?: string;
};

export type PlanParticipant = {
  userId: string;
  displayName: string;
  role: ParticipantRole;
  rsvp?: RsvpStatus;
};

export type PlanVote = {
  suggestionId: string;
  userId: string;
  createdAt: string;
};

export type PlanSuggestion = {
  id: string;
  planId: string;
  slot: PlanSlot;
  place: PlaceSnapshot;
  createdBy: string;
  createdAt: string;
  votes: PlanVote[];
};

export type PlanStop = {
  id: string;
  planId: string;
  position: number;
  place: PlaceSnapshot;
  travelMode?: TravelMode;
  arrivalTime?: string;
  durationMinutes?: number;
};

export type Plan = {
  id: string;
  ownerId: string;
  title: string;
  intent: PlanIntent;
  status: PlanStatus;
  locationLabel: string;
  dateStart: string;
  dateEnd: string;
  timeWindow?: string;
  participants: PlanParticipant[];
  suggestions: PlanSuggestion[];
  stops: PlanStop[];
  createdAt: string;
  updatedAt: string;
};

export type PlanInvite = {
  planId: string;
  token: string;
  expiresAt: string;
};
