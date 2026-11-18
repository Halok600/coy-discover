export type SeedProfile = {
  name: string;
  age: number;
  /** i.pravatar.cc placeholder photo id (1-70) */
  photo: number;
  location: string;
  bio: string;
  interests: string[];
};

/**
 * Deterministic UUIDs (valid v4 shape) so re-seeding upserts the same rows and
 * the e2e/unit tests can address members without a lookup.
 */
export function memberId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

/** Placeholder portraits (640px). Names, bios and people here are fictional. */
export function photoUrl(photo: number): string {
  return `https://i.pravatar.cc/640?img=${photo}`;
}

export const SEED_PROFILES: readonly SeedProfile[] = [
  {
    name: "Aanya Sharma",
    age: 21,
    photo: 5,
    location: "Delhi University, Delhi",
    bio: "Literature major who reviews every cafe she visits. Ask me about my unreasonably long reading list.",
    interests: ["Books", "Coffee", "Poetry", "Theatre"],
  },
  {
    name: "Rohan Mehta",
    age: 23,
    photo: 59,
    location: "IIT Bombay, Mumbai",
    bio: "Builds robots by day, plays badly tuned guitar by night. Looking for someone to critique my playlists.",
    interests: ["Robotics", "Guitar", "Football", "Startups"],
  },
  {
    name: "Ishita Rao",
    age: 22,
    photo: 44,
    location: "Christ University, Bengaluru",
    bio: "Psychology student and weekend trekker. I will absolutely overpack for a one-night trip.",
    interests: ["Trekking", "Psychology", "Photography", "Podcasts"],
  },
  {
    name: "Kabir Singh",
    age: 25,
    photo: 12,
    location: "Chandigarh",
    bio: "Product designer who is mildly obsessed with typography. Best dal makhani in the city is my hill to die on.",
    interests: ["Design", "Cooking", "Cycling", "Fonts"],
  },
  {
    name: "Meera Iyer",
    age: 20,
    photo: 42,
    location: "SRM Institute, Chennai",
    bio: "Bharatanatyam since I was six, filter coffee since I was twelve. Always up for a beach walk.",
    interests: ["Dance", "Filter coffee", "Beaches", "Carnatic music"],
  },
  {
    name: "Arjun Nair",
    age: 24,
    photo: 60,
    location: "Kochi",
    bio: "Marine biology grad turned data analyst. Will happily explain why octopuses are geniuses.",
    interests: ["Diving", "Data", "Football", "Seafood"],
  },
  {
    name: "Tara Kapoor",
    age: 22,
    photo: 32,
    location: "Symbiosis, Pune",
    bio: "Journalism student chasing stories and decent chai. Strong opinions about movie sequels.",
    interests: ["Writing", "Cinema", "Chai", "Travel"],
  },
  {
    name: "Vihaan Reddy",
    age: 26,
    photo: 8,
    location: "Hyderabad",
    bio: "Backend engineer who unwinds on the badminton court. Biryani debates welcome, but I am right.",
    interests: ["Badminton", "Coding", "Biryani", "Gaming"],
  },
  {
    name: "Saanvi Gupta",
    age: 19,
    photo: 36,
    location: "Lady Shri Ram College, Delhi",
    bio: "First-year economics student who joined five societies and regrets nothing. Debate team, mostly.",
    interests: ["Debating", "Economics", "Thrifting", "Indie music"],
  },
  {
    name: "Aarav Joshi",
    age: 21,
    photo: 14,
    location: "BITS Pilani, Rajasthan",
    bio: "Campus DJ and part-time chess hustler. Ask me for a song recommendation and then regret it.",
    interests: ["DJing", "Chess", "Electronic music", "Memes"],
  },
  {
    name: "Diya Bansal",
    age: 23,
    photo: 45,
    location: "Jaipur",
    bio: "Architect in training who sketches every building she walks past. Terrible at directions, great at planning.",
    interests: ["Architecture", "Sketching", "Heritage walks", "Chai"],
  },
  {
    name: "Krish Malhotra",
    age: 27,
    photo: 53,
    location: "Gurugram",
    bio: "Consultant by weekday, amateur baker on Sundays. My sourdough starter has a name and a following.",
    interests: ["Baking", "Running", "Finance", "Board games"],
  },
  {
    name: "Anika Desai",
    age: 20,
    photo: 27,
    location: "MIT-WPU, Pune",
    bio: "Computer science student building a weather app nobody asked for. Fuelled entirely by iced coffee.",
    interests: ["Coding", "Weather", "Iced coffee", "Anime"],
  },
  {
    name: "Reyansh Pillai",
    age: 22,
    photo: 33,
    location: "NIT Calicut, Kerala",
    bio: "Mechanical engineering student and the person you call when your bike breaks down. Sunset chaser.",
    interests: ["Motorcycles", "Sunsets", "Cricket", "Mechanics"],
  },
  {
    name: "Navya Menon",
    age: 24,
    photo: 28,
    location: "Bengaluru",
    bio: "UX researcher who asks follow-up questions for fun. Plant parent to eleven slightly dramatic succulents.",
    interests: ["Plants", "UX", "Yoga", "Board games"],
  },
  {
    name: "Ishaan Chopra",
    age: 25,
    photo: 13,
    location: "Delhi",
    bio: "Stand-up open mic regular with a 40 percent success rate. Will trade a bad joke for a good momo.",
    interests: ["Comedy", "Momos", "Writing", "Cricket"],
  },
  {
    name: "Pari Verma",
    age: 18,
    photo: 25,
    location: "Amity University, Noida",
    bio: "Fresher still learning the metro map. Into K-dramas, sketchbooks and late-night maggi.",
    interests: ["K-dramas", "Sketching", "Maggi", "Nail art"],
  },
  {
    name: "Advait Kulkarni",
    age: 23,
    photo: 52,
    location: "COEP, Pune",
    bio: "Electronics student and weekend photographer. I shoot film because I like waiting for surprises.",
    interests: ["Photography", "Electronics", "Trekking", "Film"],
  },
  {
    name: "Riya Banerjee",
    age: 22,
    photo: 47,
    location: "Presidency University, Kolkata",
    bio: "History nerd who gives unsolicited walking tours of old Kolkata. Fish curry over everything.",
    interests: ["History", "Street food", "Adda", "Photography"],
  },
  {
    name: "Samar Bhatia",
    age: 26,
    photo: 54,
    location: "Mumbai",
    bio: "Film editor who can quote scenes from memory. Looking for a co-pilot for slow Sunday brunches.",
    interests: ["Film", "Brunch", "Music", "Cycling"],
  },
  {
    name: "Kiara Shah",
    age: 21,
    photo: 26,
    location: "NMIMS, Mumbai",
    bio: "Marketing student with a spreadsheet for everything, including my snack budget. Garba is life.",
    interests: ["Garba", "Marketing", "Snacks", "Travel"],
  },
  {
    name: "Dev Agarwal",
    age: 20,
    photo: 15,
    location: "VIT Vellore, Tamil Nadu",
    bio: "Third-year CSE student, full-time gym rat, part-time hackathon survivor. Ask me about my last all-nighter.",
    interests: ["Hackathons", "Gym", "Football", "Coding"],
  },
  {
    name: "Sneha Pandey",
    age: 24,
    photo: 21,
    location: "Lucknow",
    bio: "Doctor in the making and a terrible sleeper. I bake when I am stressed, so you can guess how often.",
    interests: ["Baking", "Medicine", "Kathak", "Mystery novels"],
  },
  {
    name: "Yash Thakur",
    age: 22,
    photo: 11,
    location: "IIT Roorkee, Uttarakhand",
    bio: "Civil engineering student who has opinions about every bridge. Mountains over beaches, no negotiation.",
    interests: ["Mountains", "Bridges", "Chess", "Cricket"],
  },
  {
    name: "Zoya Khan",
    age: 23,
    photo: 16,
    location: "Jamia Millia Islamia, Delhi",
    bio: "Mass communication student behind the lens. Always chasing golden hour and a good paratha.",
    interests: ["Filmmaking", "Parathas", "Poetry", "Street photography"],
  },
  {
    name: "Neel Saxena",
    age: 27,
    photo: 68,
    location: "Indore",
    bio: "Runs a small family cafe and a smaller podcast. Poha is a personality trait, not just breakfast.",
    interests: ["Podcasts", "Poha", "Entrepreneurship", "Badminton"],
  },
  {
    name: "Mahi Rathore",
    age: 21,
    photo: 41,
    location: "Manipal University, Karnataka",
    bio: "Pharmacy student and part-time baker of surprisingly good brownies. Sunrise runs, then sleep all day.",
    interests: ["Running", "Brownies", "Pharmacy", "Sketching"],
  },
  {
    name: "Aditya Bose",
    age: 25,
    photo: 3,
    location: "Kolkata",
    bio: "Software tester who breaks things professionally and relationships never. Bengali sweets are my love language.",
    interests: ["Football", "Sweets", "Music", "Gaming"],
  },
  {
    name: "Tanvi Jain",
    age: 19,
    photo: 10,
    location: "St. Xavier's College, Ahmedabad",
    bio: "Commerce student and lifelong chai snob. Collects vintage postcards and bad puns.",
    interests: ["Postcards", "Chai", "Puns", "Thrifting"],
  },
  {
    name: "Rudra Pratap",
    age: 24,
    photo: 55,
    location: "Bhopal",
    bio: "Wildlife photography is my escape and a lot of waiting is my job. Early mornings feel like home.",
    interests: ["Wildlife", "Photography", "Birdwatching", "Cooking"],
  },
  {
    name: "Ananya Das",
    age: 22,
    photo: 20,
    location: "Tezpur University, Assam",
    bio: "Environmental science student who will not stop talking about hornbills. Tea garden girl at heart.",
    interests: ["Birdwatching", "Tea", "Ecology", "Folk music"],
  },
  {
    name: "Karan Oberoi",
    age: 24,
    photo: 56,
    location: "Goa",
    bio: "Sound engineer who moved to the coast for the sunsets and stayed for the live gigs. Will absolutely make you a playlist.",
    interests: ["Live music", "Surfing", "Audio gear", "Seafood"],
  },
];
