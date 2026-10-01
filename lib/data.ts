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
  gender: 'Male' | 'Female';
}

export const therapists: Therapist[] = [
  {
    id: 1,
    name: "Dr. Selamawit Tadesse",
    title: "Clinical Psychologist",
    specialties: ["Anxiety & Stress", "Depression", "Trauma & PTSD"],
    bio: "Dr. Selamawit is a compassionate clinical psychologist with a deep commitment to helping individuals find their inner strength. She creates a warm, non-judgmental space where healing happens naturally.",
    education: [
      "Ph.D. in Clinical Psychology — Addis Ababa University",
      "M.Sc. in Counseling Psychology — University of South Africa",
      "Certified Trauma-Focused CBT Practitioner",
    ],
    yearsExperience: 12,
    languages: ["Amharic", "English"],
    approaches: ["Cognitive Behavioral Therapy (CBT)", "Trauma-Focused Therapy", "Mindfulness-Based Therapy"],
    priceOnline: 1200,
    priceInPerson: 1600,
    rating: 4.9,
    reviewCount: 127,
    availability: "Mon, Wed, Fri",
    imageColor: "from-peach to-amber-300",
    badge: "Top Rated",
    gender: "Female",
  },
  {
    id: 2,
    name: "Dawit Mekonnen, MSc",
    title: "Psychotherapist & Counselor",
    specialties: ["Relationship Issues", "Self-Esteem", "Life Transitions"],
    bio: "Dawit brings warmth and genuine curiosity to every session. He believes that every person holds the wisdom they need — his role is simply to help you find it. Specializing in relationship dynamics and personal growth.",
    education: [
      "M.Sc. in Psychotherapy — Jimma University",
      "B.A. in Psychology — Addis Ababa University",
      "Certified Gottman Method Couples Therapist",
    ],
    yearsExperience: 8,
    languages: ["Amharic", "English", "Oromiffa"],
    approaches: ["Person-Centered Therapy", "Gottman Method", "Solution-Focused Brief Therapy"],
    priceOnline: 900,
    priceInPerson: 1300,
    rating: 4.8,
    reviewCount: 94,
    availability: "Tue, Thu, Sat",
    imageColor: "from-sage to-emerald-400",
    gender: "Male",
  },
  {
    id: 3,
    name: "Dr. Hiwot Girma",
    title: "Child & Adolescent Psychologist",
    specialties: ["Child Behavior", "Adolescent Challenges", "Family Therapy"],
    bio: "Dr. Hiwot has dedicated her career to supporting children and families through some of life's most challenging moments. Her playful, empathetic approach puts young clients at ease and creates lasting change.",
    education: [
      "Ph.D. in Child Psychology — Haramaya University",
      "M.Sc. in Family Therapy — UNISA",
      "Certified Play Therapist",
    ],
    yearsExperience: 15,
    languages: ["Amharic", "English"],
    approaches: ["Play Therapy", "Family Systems Therapy", "Narrative Therapy"],
    priceOnline: 1100,
    priceInPerson: 1500,
    rating: 5.0,
    reviewCount: 211,
    availability: "Mon, Tue, Thu",
    imageColor: "from-purple-300 to-pink-300",
    badge: "Most Loved",
    gender: "Female",
  },
  {
    id: 4,
    name: "Yonas Bekele, MSc",
    title: "Counseling Psychologist",
    specialties: ["Grief & Loss", "Work Stress", "Men's Mental Health"],
    bio: "Yonas is a dedicated counselor who understands the unique pressures men face in silence. He provides a safe, confidential space for men to open up, heal, and thrive — without judgment, without pressure.",
    education: [
      "M.Sc. in Counseling Psychology — Mekelle University",
      "B.Sc. in Psychology — Bahir Dar University",
    ],
    yearsExperience: 6,
    languages: ["Amharic", "English", "Tigrinya"],
    approaches: ["Acceptance & Commitment Therapy (ACT)", "Grief Counseling", "Motivational Interviewing"],
    priceOnline: 800,
    priceInPerson: 1100,
    rating: 4.7,
    reviewCount: 62,
    availability: "Wed, Fri, Sat",
    imageColor: "from-blue-300 to-sky-400",
    gender: "Male",
  },
  {
    id: 5,
    name: "Sara Abebe, MA",
    title: "Licensed Counselor & Mindfulness Coach",
    specialties: ["Anxiety", "Burnout & Overwhelm", "Women's Wellness"],
    bio: "Sara weaves mindfulness and evidence-based counseling into a holistic approach that nurtures the mind, body, and spirit. She is passionate about helping women rediscover their joy and reclaim their inner peace.",
    education: [
      "M.A. in Counseling — Unity University",
      "Certified Mindfulness-Based Stress Reduction (MBSR) Teacher",
      "Yoga Therapy Certificate — International Association",
    ],
    yearsExperience: 9,
    languages: ["Amharic", "English"],
    approaches: ["Mindfulness-Based Cognitive Therapy", "Somatic Therapy", "Positive Psychology"],
    priceOnline: 950,
    priceInPerson: 1350,
    rating: 4.9,
    reviewCount: 88,
    availability: "Mon, Wed, Sat",
    imageColor: "from-rose-300 to-pink-400",
    badge: "New",
    gender: "Female",
  },
  {
    id: 6,
    name: "Dr. Eyob Hailu",
    title: "Psychiatrist & Psychotherapist",
    specialties: ["Mood Disorders", "OCD", "Psychosis"],
    bio: "Dr. Eyob combines psychiatric expertise with psychotherapeutic depth to provide truly comprehensive mental health care. His calm, scholarly presence has helped hundreds of clients find stability and renewed hope.",
    education: [
      "M.D. in Medicine — Addis Ababa University School of Medicine",
      "Specialization in Psychiatry — AAU Black Lion Hospital",
      "Fellowship in Psychotherapy — WHO Collaborating Center",
    ],
    yearsExperience: 18,
    languages: ["Amharic", "English"],
    approaches: ["Integrated Psychiatric Care", "CBT", "Psychodynamic Therapy"],
    priceOnline: 1500,
    priceInPerson: 2000,
    rating: 4.8,
    reviewCount: 176,
    availability: "Mon, Thu",
    imageColor: "from-indigo-300 to-violet-400",
    badge: "Psychiatrist",
    gender: "Male",
  },
];

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
