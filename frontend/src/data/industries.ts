/**
 * Industry categories with proper 6-digit NAICS codes
 * Based on US Census Bureau official classifications
 */

export interface Industry {
  value: string;
  label: string;
  naics: string;
  icon?: string;
  description?: string;
}

export const INDUSTRIES: Industry[] = [
  // Food & Beverage
  { 
    value: 'restaurant', 
    label: 'Restaurant/Food Service', 
    naics: '722511',
    icon: '🍽️',
    description: 'Full-Service Restaurants'
  },
  
  // Retail
  { 
    value: 'retail', 
    label: 'Retail Store', 
    naics: '448140',
    icon: '🛍️',
    description: 'Clothing/General Retail'
  },
  { 
    value: 'ecommerce', 
    label: 'Online Store', 
    naics: '454110',
    icon: '💻',
    description: 'E-commerce'
  },
  
  // Construction & Trades
  { 
    value: 'construction', 
    label: 'Construction', 
    naics: '236220',
    icon: '🏗️',
    description: 'General Contractor'
  },
  { 
    value: 'home_services', 
    label: 'Home Services', 
    naics: '238220',
    icon: '🔧',
    description: 'Plumbing/HVAC/Electrical'
  },
  
  // Healthcare
  { 
    value: 'healthcare', 
    label: 'Healthcare/Medical', 
    naics: '621111',
    icon: '🏥',
    description: 'Medical Office/Clinic'
  },
  
  // Technology & Professional
  { 
    value: 'technology', 
    label: 'Technology/Software', 
    naics: '541511',
    icon: '💻',
    description: 'Software Development'
  },
  { 
    value: 'consulting', 
    label: 'Consulting Services', 
    naics: '541611',
    icon: '📊',
    description: 'Business Consulting'
  },
  
  // Manufacturing
  { 
    value: 'manufacturing', 
    label: 'Manufacturing', 
    naics: '332710',
    icon: '🏭',
    description: 'Manufacturing/Production'
  },
  
  // Finance & Real Estate
  { 
    value: 'finance', 
    label: 'Finance/Insurance', 
    naics: '523940',
    icon: '💰',
    description: 'Financial Services'
  },
  { 
    value: 'real_estate', 
    label: 'Real Estate', 
    naics: '531210',
    icon: '🏠',
    description: 'Real Estate Services'
  },
  
  // Education
  { 
    value: 'education', 
    label: 'Education/Training', 
    naics: '611699',
    icon: '🎓',
    description: 'Training Center'
  },
  
  // Transportation
  { 
    value: 'transportation', 
    label: 'Transportation/Delivery', 
    naics: '484110',
    icon: '🚚',
    description: 'Local Trucking/Delivery'
  },
  
  // Hospitality
  { 
    value: 'hospitality', 
    label: 'Hotel/Lodging', 
    naics: '721110',
    icon: '🏨',
    description: 'Hotels and Motels'
  },
  
  // Automotive
  { 
    value: 'automotive', 
    label: 'Auto Repair', 
    naics: '811111',
    icon: '🚗',
    description: 'Auto Repair Shop'
  },
  
  // Agriculture
  { 
    value: 'agriculture', 
    label: 'Agriculture/Farming', 
    naics: '111998',
    icon: '🌾',
    description: 'Farming'
  },
  
  // Personal Care
  { 
    value: 'beauty', 
    label: 'Beauty/Salon/Spa', 
    naics: '812112',
    icon: '💇',
    description: 'Beauty Salons'
  },
  { 
    value: 'fitness', 
    label: 'Gym/Fitness', 
    naics: '713940',
    icon: '💪',
    description: 'Fitness Centers'
  }
];

/**
 * Quick category groups for UI display
 */
export const INDUSTRY_GROUPS = {
  'Popular': ['restaurant', 'retail', 'healthcare', 'construction'],
  'Services': ['consulting', 'home_services', 'beauty', 'automotive'],
  'Digital': ['technology', 'ecommerce'],
  'Specialized': ['manufacturing', 'agriculture', 'transportation']
};

/**
 * Employee count ranges with thresholds that trigger different requirements
 */
export const EMPLOYEE_RANGES = [
  { value: '1', label: 'Just me (1)', min: 1, max: 1 },
  { value: '2-14', label: '2-14 employees', min: 2, max: 14 },
  { value: '15-49', label: '15-49 employees', min: 15, max: 49, note: 'ACA requirements apply' },
  { value: '50-99', label: '50-99 employees', min: 50, max: 99, note: 'FMLA & ACA apply' },
  { value: '100-499', label: '100-499 employees', min: 100, max: 499, note: 'EEO-1 reporting required' },
  { value: '500+', label: '500+ employees', min: 500, max: 10000, note: 'Additional federal requirements' }
];

/**
 * Revenue ranges (affects SBA size standards)
 */
export const REVENUE_RANGES = [
  { value: '0-100k', label: 'Under $100K', min: 0, max: 100000 },
  { value: '100k-500k', label: '$100K - $500K', min: 100000, max: 500000 },
  { value: '500k-1m', label: '$500K - $1M', min: 500000, max: 1000000 },
  { value: '1m-5m', label: '$1M - $5M', min: 1000000, max: 5000000 },
  { value: '5m-10m', label: '$5M - $10M', min: 5000000, max: 10000000 },
  { value: '10m+', label: 'Over $10M', min: 10000000, max: 999999999 }
];