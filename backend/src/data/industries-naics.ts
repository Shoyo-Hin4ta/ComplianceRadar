/**
 * Industry categories with proper 6-digit NAICS codes
 * Used for accurate compliance requirement matching
 */

export interface Industry {
  value: string;
  label: string;
  naics: string;
  description?: string;
}

export const INDUSTRIES: Industry[] = [
  // Food & Beverage
  { 
    value: 'restaurant', 
    label: 'Restaurant/Food Service', 
    naics: '722511',
    description: 'Full-Service Restaurants'
  },
  
  // Retail
  { 
    value: 'retail', 
    label: 'Retail Store', 
    naics: '448140',
    description: 'Family Clothing Stores / General Retail'
  },
  { 
    value: 'ecommerce', 
    label: 'Online Store/E-commerce', 
    naics: '454110',
    description: 'Electronic Shopping and Mail-Order Houses'
  },
  
  // Construction & Home Services
  { 
    value: 'construction', 
    label: 'Construction', 
    naics: '236220',
    description: 'Commercial and Institutional Building Construction'
  },
  { 
    value: 'plumbing_hvac', 
    label: 'Plumbing/HVAC Services', 
    naics: '238220',
    description: 'Plumbing, Heating, and Air-Conditioning Contractors'
  },
  
  // Healthcare
  { 
    value: 'healthcare', 
    label: 'Healthcare/Medical', 
    naics: '621111',
    description: 'Offices of Physicians'
  },
  
  // Technology & Professional Services
  { 
    value: 'technology', 
    label: 'Technology/Software', 
    naics: '541511',
    description: 'Custom Computer Programming Services'
  },
  { 
    value: 'consulting', 
    label: 'Consulting/Professional Services', 
    naics: '541611',
    description: 'Administrative Management & General Management Consulting'
  },
  
  // Manufacturing
  { 
    value: 'manufacturing', 
    label: 'Manufacturing', 
    naics: '332710',
    description: 'Machine Shops (example - varies by product)'
  },
  
  // Finance & Real Estate
  { 
    value: 'finance', 
    label: 'Finance/Insurance', 
    naics: '523940',
    description: 'Portfolio Management and Investment Advice'
  },
  { 
    value: 'real_estate', 
    label: 'Real Estate', 
    naics: '531210',
    description: 'Offices of Real Estate Agents and Brokers'
  },
  
  // Education & Training
  { 
    value: 'education', 
    label: 'Education/Training', 
    naics: '611699',
    description: 'All Other Miscellaneous Schools and Instruction'
  },
  
  // Transportation & Logistics
  { 
    value: 'transportation', 
    label: 'Transportation/Delivery', 
    naics: '484110',
    description: 'General Freight Trucking, Local'
  },
  
  // Hospitality
  { 
    value: 'hospitality', 
    label: 'Hotels/Hospitality', 
    naics: '721110',
    description: 'Hotels and Motels'
  },
  
  // Automotive
  { 
    value: 'automotive', 
    label: 'Automotive Services', 
    naics: '811111',
    description: 'General Automotive Repair Shops'
  },
  
  // Agriculture
  { 
    value: 'agriculture', 
    label: 'Agriculture/Farming', 
    naics: '111998',
    description: 'All Other Miscellaneous Crop Farming'
  },
  
  // Personal Care & Wellness
  { 
    value: 'beauty', 
    label: 'Beauty/Salon/Spa', 
    naics: '812112',
    description: 'Beauty Salons'
  },
  { 
    value: 'fitness', 
    label: 'Gym/Fitness Center', 
    naics: '713940',
    description: 'Fitness and Recreational Sports Centers'
  },
  
  // Other
  { 
    value: 'other', 
    label: 'Other', 
    naics: '',
    description: 'Industry not listed'
  }
];

/**
 * Helper function to get NAICS code by industry value
 */
export function getNAICSCode(industryValue: string): string {
  const industry = INDUSTRIES.find(i => i.value === industryValue);
  return industry?.naics || '';
}

/**
 * Helper function to get industry label by value
 */
export function getIndustryLabel(industryValue: string): string {
  const industry = INDUSTRIES.find(i => i.value === industryValue);
  return industry?.label || industryValue;
}

/**
 * Map of common business types to their NAICS codes
 * For quick lookup and validation
 */
export const NAICS_MAP: Record<string, string> = {
  // Food Service
  'restaurant': '722511',
  'fast_food': '722513',
  'bar': '722410',
  'catering': '722320',
  'food_truck': '722330',
  
  // Retail
  'clothing_store': '448140',
  'grocery_store': '445110',
  'hardware_store': '444130',
  'pharmacy': '446110',
  'convenience_store': '445131',
  'online_retail': '454110',
  
  // Professional Services
  'accounting': '541211',
  'law_firm': '541110',
  'architect': '541310',
  'engineering': '541330',
  'marketing': '541810',
  'software': '541511',
  
  // Healthcare
  'doctor_office': '621111',
  'dentist': '621210',
  'chiropractor': '621310',
  'veterinary': '541940',
  'home_health': '621610',
  
  // Personal Services
  'hair_salon': '812112',
  'nail_salon': '812113',
  'barbershop': '812111',
  'dry_cleaning': '812320',
  'pet_grooming': '812910',
  
  // Home Services
  'plumbing': '238220',
  'electrical': '238210',
  'landscaping': '561730',
  'cleaning': '561720',
  'pest_control': '561710',
  
  // Transportation
  'taxi': '485310',
  'trucking_local': '484110',
  'trucking_long': '484121',
  'moving': '484210',
  'courier': '492110'
};