// Therapist data for Addis Psychology Platform

export interface Therapist {
  id: number;
  name: string;
  title: string;
  specialties: string[];
  bio: string;
  education: string[];
  yearsExperience: number;
  languages: string[];
  approaches: string[];
  priceOnline: number;
  priceInPerson: number;
  rating: number;
  reviewCount: number;
  availability: string;
  imageColor: string; // gradient color for avatar placeholder
  badge?: string;
  gender: 'Male' | 'Female' | 'Unspecified';
}

export const therapists: Therapist[] = [];

export const concernOptions = [
  { id: "anxiety", label: "Anxiety & Worry", emoji: "🌊", description: "Racing thoughts, nervousness, or constant worry" },
  { id: "depression", label: "Depression & Sadness", emoji: "🌧️", description: "Feeling low, hopeless, or losing interest in things" },
  { id: "relationships", label: "Relationships", emoji: "💞", description: "Family, romantic, or friendship challenges" },
  { id: "trauma", label: "Trauma & PTSD", emoji: "🌿", description: "Processing past painful experiences" },
  { id: "stress", label: "Stress & Burnout", emoji: "🔥", description: "Overwhelm from work, life, or responsibilities" },
  { id: "grief", label: "Grief & Loss", emoji: "🕊️", description: "Coping with loss of a loved one or major change" },
  { id: "selfesteem", label: "Self-Esteem", emoji: "✨", description: "Building confidence and self-worth" },
  { id: "anger", label: "Anger Management", emoji: "⚡", description: "Understanding and managing difficult emotions" },
  { id: "addiction", label: "Addiction & Habits", emoji: "🔓", description: "Breaking unhealthy patterns and dependencies" },
  { id: "other", label: "Something Else", emoji: "💬", description: "Tell us in your own words" },
];

export const sessionMediums = [
  { id: "online", label: "Online Session", emoji: "💻", description: "Video call from anywhere you feel comfortable" },
  { id: "in-person", label: "In-Person Session", emoji: "🏥", description: "Face-to-face at our welcoming Addis Ababa office" },
  { id: "both", label: "Either Works", emoji: "🌟", description: "I'm flexible, show me all options" },
];

export const paymentPlans = [
  {
    id: "single",
    label: "First Session",
    subtitle: "Just getting started",
    description: "Pay for one session. No commitment, no pressure. Just take that first brave step.",
    badge: "Most Flexible",
    color: "peach",
    discount: null,
    billingNote: "Pay per session after we confirm your schedule",
    icon: "🌱",
  },
  {
    id: "biweekly",
    label: "Bi-Weekly Plan",
    subtitle: "2 sessions per month",
    description: "A gentle, consistent rhythm. Two sessions a month gives your healing momentum.",
    badge: "Popular",
    color: "sage",
    discount: 10,
    billingNote: "Billed monthly — payment after your first call with us",
    icon: "🌿",
  },
  {
    id: "monthly",
    label: "Monthly Plan",
    subtitle: "4 sessions per month",
    description: "The deepest investment in yourself. Weekly sessions for the most meaningful, lasting transformation.",
    badge: "Best Value",
    color: "gold",
    discount: 20,
    billingNote: "Best savings — payment after we confirm with you",
    icon: "🌸",
  },
];

export const chatPackages = [
  {
    id: "starter",
    label: "Starter Chat",
    pricePerWord: 0.5,
    voiceMailPrice: 15,
    description: "Perfect for occasional check-ins and light support between sessions.",
    icon: "💬",
  },
  {
    id: "regular",
    label: "Regular Chat",
    pricePerWord: 0.35,
    voiceMailPrice: 10,
    description: "Stay connected with your therapist more frequently. A warmer, closer support system.",
    icon: "🗣️",
  },
  {
    id: "unlimited",
    label: "Unlimited Chat",
    pricePerWord: 0.2,
    voiceMailPrice: 8,
    description: "Always there, always listening. The most immersive between-session support available.",
    icon: "🌟",
  },
];
