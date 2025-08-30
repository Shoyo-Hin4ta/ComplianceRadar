import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Users, 
  DollarSign, 
  AlertCircle,
  FileCheck,
  ChevronRight,
  Check
} from 'lucide-react';
import { INDUSTRIES, EMPLOYEE_RANGES, REVENUE_RANGES } from '../data/industries';
import { State, City } from 'country-state-city';

interface BusinessProfile {
  state: string;
  city: string;
  industry: string;
  naicsCode?: string;
  employeeCount: number;
  annualRevenue?: number;
  specialFactors: string[];
}

interface ComplianceFormProps {
  onSubmit: (profile: BusinessProfile) => void;
  isLoading?: boolean;
}

const SPECIAL_FACTORS = [
  { id: 'physical', label: 'Has physical location', icon: '🏢' },
  { id: 'products', label: 'Sells products', icon: '📦' },
  { id: 'services', label: 'Sells services', icon: '🛠️' },
  { id: 'vehicles', label: 'Operates vehicles', icon: '🚚' },
  { id: 'food', label: 'Handles food/beverage', icon: '🍔' },
  { id: 'data', label: 'Stores personal data', icon: '🔒' },
  { id: 'payments', label: 'Accepts online payments', icon: '💳' },
  { id: 'hazardous', label: 'Handles hazardous materials', icon: '⚠️' },
  { id: 'llc', label: 'Business structure: LLC', icon: '🏛️' },
  { id: 'corp', label: 'Business structure: Corporation', icon: '🏢' },
];

export const ComplianceForm: React.FC<ComplianceFormProps> = ({ onSubmit, isLoading = false }) => {
  const [formData, setFormData] = useState<BusinessProfile>({
    state: '',
    city: '',
    industry: '',
    employeeCount: 0, // Start with 0 to force selection
    annualRevenue: undefined,
    specialFactors: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [selectedEmployeeRange, setSelectedEmployeeRange] = useState<string>('');
  const [selectedRevenueRange, setSelectedRevenueRange] = useState<string>('');

  // Get US states
  const states = State.getStatesOfCountry('US');
  
  // Get cities for selected state
  const cities = formData.state ? City.getCitiesOfState('US', formData.state) : [];
  const hasNoCities = formData.state && cities.length === 0;

  const handleIndustrySelect = (industry: typeof INDUSTRIES[0]) => {
    setSelectedIndustry(industry.value);
    setFormData(prev => ({
      ...prev,
      industry: industry.value,
      naicsCode: industry.naics
    }));
    setErrors(prev => ({ ...prev, industry: '' }));
  };

  const handleEmployeeRangeSelect = (range: typeof EMPLOYEE_RANGES[0]) => {
    setSelectedEmployeeRange(range.value);
    // Use the middle value of the range for the actual count
    const employeeCount = range.min === range.max ? range.min : Math.floor((range.min + range.max) / 2);
    setFormData(prev => ({ ...prev, employeeCount }));
    setErrors(prev => ({ ...prev, employeeCount: '' }));
  };

  const handleRevenueRangeSelect = (range: typeof REVENUE_RANGES[0]) => {
    setSelectedRevenueRange(range.value);
    // Use the middle value of the range
    const revenue = Math.floor((range.min + range.max) / 2);
    setFormData(prev => ({ ...prev, annualRevenue: revenue }));
  };

  const toggleSpecialFactor = (factor: string) => {
    setFormData(prev => {
      const factors = prev.specialFactors.includes(factor)
        ? prev.specialFactors.filter(f => f !== factor)
        : [...prev.specialFactors, factor];
      return { ...prev, specialFactors: factors };
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.state) newErrors.state = 'Please select a state';
    // Only require city if cities are available for the selected state
    if (!hasNoCities && !formData.city) newErrors.city = 'Please select a city';
    if (!formData.industry) newErrors.industry = 'Please select an industry';
    if (!formData.employeeCount || formData.employeeCount === 0) newErrors.employeeCount = 'Please select employee count';
    // Annual revenue is optional - no validation needed

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="min-h-screen bg-base-100 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center mb-4">
            <FileCheck className="w-10 h-10 text-primary mr-3" />
            <h1 className="text-4xl font-bold text-base-content">
              US Business Compliance Checker
            </h1>
          </div>
          <p className="text-base-content/70 text-lg">
            Find every requirement. Miss nothing. Stay compliant.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Location Section */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <div className="flex items-center mb-4">
                <MapPin className="w-6 h-6 text-primary mr-2" />
                <h2 className="card-title text-2xl">Where's your business?</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">State *</span>
                  </label>
                  <select
                    className={`select select-bordered w-full ${errors.state ? 'select-error' : ''}`}
                    value={formData.state}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, state: e.target.value, city: '' }));
                      setErrors(prev => ({ ...prev, state: '' }));
                    }}
                  >
                    <option value="">Select a state</option>
                    {states.map(state => (
                      <option key={state.isoCode} value={state.isoCode}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                  {errors.state && (
                    <label className="label">
                      <span className="label-text-alt text-error">{errors.state}</span>
                    </label>
                  )}
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">City {!hasNoCities && '*'}</span>
                  </label>
                  <select
                    className={`select select-bordered w-full ${errors.city ? 'select-error' : ''}`}
                    value={formData.city}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, city: e.target.value }));
                      setErrors(prev => ({ ...prev, city: '' }));
                    }}
                    disabled={!formData.state || hasNoCities}
                  >
                    <option value="">{hasNoCities ? 'No cities available' : 'Select a city'}</option>
                    {cities.map(city => (
                      <option key={city.name} value={city.name}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                  {hasNoCities && (
                    <div className="alert alert-info mt-2">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">This territory has no city selection required</span>
                    </div>
                  )}
                  {errors.city && (
                    <label className="label">
                      <span className="label-text-alt text-error">{errors.city}</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Industry Section */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <div className="flex items-center mb-4">
                <Building2 className="w-6 h-6 text-primary mr-2" />
                <h2 className="card-title text-2xl">What industry are you in?</h2>
              </div>
              {errors.industry && (
                <div className="alert alert-error mb-4">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.industry}</span>
                </div>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {INDUSTRIES.map(industry => (
                  <button
                    key={industry.value}
                    type="button"
                    onClick={() => handleIndustrySelect(industry)}
                    className={`btn btn-lg flex flex-col h-auto py-4 px-3 ${
                      selectedIndustry === industry.value 
                        ? 'btn-primary' 
                        : 'btn-outline'
                    }`}
                  >
                    <span className="text-2xl mb-1">{industry.icon}</span>
                    <span className="text-xs font-medium">{industry.label}</span>
                    <span className="text-xs opacity-60">NAICS: {industry.naics}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Size & Revenue Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Employee Count */}
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <div className="flex items-center mb-4">
                  <Users className="w-6 h-6 text-primary mr-2" />
                  <h2 className="card-title">How many employees? *</h2>
                </div>
                {errors.employeeCount && (
                  <div className="alert alert-error mb-4">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.employeeCount}</span>
                  </div>
                )}
                
                <div className="space-y-2">
                  {EMPLOYEE_RANGES.map(range => (
                    <button
                      key={range.value}
                      type="button"
                      onClick={() => handleEmployeeRangeSelect(range)}
                      className={`btn btn-block justify-start ${
                        selectedEmployeeRange === range.value 
                          ? 'btn-primary' 
                          : 'btn-outline'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{range.label}</span>
                        {range.note && (
                          <span className="badge badge-warning badge-sm ml-2">
                            {range.note}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Annual Revenue */}
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <div className="flex items-center mb-4">
                  <DollarSign className="w-6 h-6 text-primary mr-2" />
                  <h2 className="card-title">Annual revenue?</h2>
                  <span className="badge badge-ghost ml-2">Optional</span>
                </div>
                
                <div className="space-y-2">
                  {REVENUE_RANGES.map(range => (
                    <button
                      key={range.value}
                      type="button"
                      onClick={() => handleRevenueRangeSelect(range)}
                      className={`btn btn-block justify-start ${
                        selectedRevenueRange === range.value 
                          ? 'btn-primary' 
                          : 'btn-outline'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Special Factors */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <div className="flex items-center mb-4">
                <AlertCircle className="w-6 h-6 text-primary mr-2" />
                <h2 className="card-title text-2xl">Special factors</h2>
                <span className="badge badge-ghost ml-2">Check all that apply</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SPECIAL_FACTORS.map(factor => (
                  <label
                    key={factor.id}
                    className={`btn btn-lg justify-start h-auto py-3 ${
                      formData.specialFactors.includes(factor.label)
                        ? 'btn-primary'
                        : 'btn-outline'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary mr-3"
                      checked={formData.specialFactors.includes(factor.label)}
                      onChange={() => toggleSpecialFactor(factor.label)}
                    />
                    <span className="text-xl mr-3">{factor.icon}</span>
                    <span className="text-left">{factor.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-lg px-8"
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner"></span>
                  Analyzing...
                </>
              ) : (
                <>
                  Find My Requirements
                  <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};