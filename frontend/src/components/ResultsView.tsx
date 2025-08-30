import React, { useState } from 'react';
import { 
  Download, 
  ExternalLink, 
  FileText, 
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

interface Requirement {
  id: string;
  name: string;
  description: string;
  source: string;
  sourceUrl?: string;
  sourceType: 'federal' | 'state' | 'city' | 'industry';
  deadline?: string;
  penalty?: string;
  formNumber?: string;
  agency?: string;
}

interface ResultsViewProps {
  requirements: Requirement[];
  businessProfile: {
    city: string;
    state: string;
    industry: string;
    naicsCode?: string;
    employeeCount: number;
  };
}

export const ResultsView: React.FC<ResultsViewProps> = ({ requirements, businessProfile }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [activeJurisdiction, setActiveJurisdiction] = useState<string | null>(null);

  // Filter and group requirements
  const filteredRequirements = requirements.filter(req => {
    // First filter by search term
    const matchesSearch = req.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.source?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Then filter by active jurisdiction if one is selected
    const matchesJurisdiction = !activeJurisdiction || req.sourceType === activeJurisdiction;
    
    return matchesSearch && matchesJurisdiction;
  });

  const groupedRequirements = React.useMemo(() => {
    // If a specific jurisdiction pill is selected, only show those requirements
    if (activeJurisdiction) {
      return { [activeJurisdiction]: filteredRequirements };
    }
    
    // If no pill is selected, group by jurisdiction
    return {
      federal: filteredRequirements.filter(r => r.sourceType === 'federal'),
      state: filteredRequirements.filter(r => r.sourceType === 'state'),
      city: filteredRequirements.filter(r => r.sourceType === 'city'),
      industry: filteredRequirements.filter(r => r.sourceType === 'industry')
    };
  }, [filteredRequirements, activeJurisdiction]);

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleJurisdictionClick = (jurisdiction: string) => {
    if (activeJurisdiction === jurisdiction) {
      // If clicking the same pill, deselect it
      setActiveJurisdiction(null);
    } else {
      // Select the new jurisdiction
      setActiveJurisdiction(jurisdiction);
    }
  };

  const exportAsJSON = () => {
    const dataStr = JSON.stringify({ requirements, businessProfile }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `compliance-requirements-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const getJurisdictionBadgeColor = (type: string) => {
    switch (type) {
      case 'federal': return 'badge-info';
      case 'state': return 'badge-success';
      case 'city': return 'badge-warning';
      case 'industry': return 'badge-secondary';
      default: return 'badge-ghost';
    }
  };

  const stats = {
    total: requirements.length,
    federal: requirements.filter(r => r.sourceType === 'federal').length,
    state: requirements.filter(r => r.sourceType === 'state').length,
    city: requirements.filter(r => r.sourceType === 'city').length,
    industry: requirements.filter(r => r.sourceType === 'industry').length
  };

  return (
    <div className="min-h-screen bg-base-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-10 h-10 text-success mr-3" />
            <h1 className="text-4xl font-bold text-base-content">
              Found {stats.total} Compliance Requirements
            </h1>
          </div>
          <p className="text-base-content/70 text-lg">
            For: {businessProfile.industry} • {businessProfile.city}, {businessProfile.state} 
            {businessProfile.naicsCode && ` • NAICS: ${businessProfile.naicsCode}`}
          </p>
        </div>


        {/* Filters and Search */}
        <div className="card bg-base-200 shadow-xl mb-6">
          <div className="card-body">
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
              {/* Search */}
              <div className="flex-1">
                <div className="relative flex items-center">
                  <div className="absolute left-3 pointer-events-none z-10">
                    <Search className="w-5 h-5 text-base-content" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search requirements..."
                    className="input input-bordered w-full pl-12 pr-4"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Export button */}
              <button className="btn btn-secondary gap-2" onClick={exportAsJSON}>
                <Download className="w-5 h-5" />
                Export JSON
              </button>
            </div>

          </div>
        </div>

        {/* Jurisdiction Filter Pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {/* All pill - to show all requirements */}
          <button 
            onClick={() => setActiveJurisdiction(null)}
            className={`btn btn-lg rounded-full transition-all hover:scale-105 ${
              !activeJurisdiction 
                ? 'btn-primary shadow-lg' 
                : 'btn-outline'
            }`}
          >
            All
            <span className="badge badge-primary badge-lg ml-2 font-bold">{stats.total}</span>
          </button>

          <div className="divider divider-horizontal"></div>
          
          <button 
            onClick={() => handleJurisdictionClick('federal')}
            className={`btn btn-lg rounded-full transition-all hover:scale-105 ${
              activeJurisdiction === 'federal' 
                ? 'btn-info shadow-lg' 
                : 'btn-outline btn-info'
            }`}
          >
            Federal
            <span className="badge badge-info badge-lg ml-2 font-bold">{stats.federal}</span>
          </button>
          
          <button 
            onClick={() => handleJurisdictionClick('state')}
            className={`btn btn-lg rounded-full transition-all hover:scale-105 ${
              activeJurisdiction === 'state' 
                ? 'btn-success shadow-lg' 
                : 'btn-outline btn-success'
            }`}
          >
            State
            <span className="badge badge-success badge-lg ml-2 font-bold">{stats.state}</span>
          </button>
          
          <button 
            onClick={() => handleJurisdictionClick('city')}
            className={`btn btn-lg rounded-full transition-all hover:scale-105 ${
              activeJurisdiction === 'city' 
                ? 'btn-warning shadow-lg' 
                : 'btn-outline btn-warning'
            }`}
          >
            City
            <span className="badge badge-warning badge-lg ml-2 font-bold">{stats.city}</span>
          </button>
          
          <button 
            onClick={() => handleJurisdictionClick('industry')}
            className={`btn btn-lg rounded-full transition-all hover:scale-105 ${
              activeJurisdiction === 'industry' 
                ? 'btn-secondary shadow-lg' 
                : 'btn-outline btn-secondary'
            }`}
          >
            Industry
            <span className="badge badge-secondary badge-lg ml-2 font-bold">{stats.industry}</span>
          </button>
        </div>

        {/* Requirements List */}
        <div className="space-y-6">
          {Object.entries(groupedRequirements).map(([group, reqs]) => (
            <div key={group}>
              {reqs.length > 0 && (
                <h2 className="text-2xl font-bold mb-4 text-base-content">
                  {`${group.charAt(0).toUpperCase() + group.slice(1)} Requirements (${reqs.length})`}
                </h2>
              )}
              
              <div className="space-y-4">
                {reqs.map((req, index) => (
                  <div key={`${group}-${index}-${req.name}`} className="card bg-base-200 shadow-xl">
                    <div className="card-body">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold text-base-content">
                              {req.name}
                            </h3>
                            <div className={`badge ${getJurisdictionBadgeColor(req.sourceType)}`}>
                              {req.sourceType}
                            </div>
                          </div>
                          
                          <div className="text-sm text-base-content/70 space-y-1">
                            {req.agency && <div><strong>Agency:</strong> {req.agency}</div>}
                            {req.formNumber && (
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                <strong>Form:</strong> 
                                <span className="truncate max-w-xs" title={req.formNumber}>
                                  {req.formNumber}
                                </span>
                              </div>
                            )}
                            {req.deadline && (
                              <div className="flex items-center gap-2 text-warning">
                                <AlertTriangle className="w-4 h-4" />
                                <strong>Deadline:</strong> {req.deadline}
                              </div>
                            )}
                            {req.penalty && (
                              <div className="flex items-center gap-2 text-error">
                                <AlertTriangle className="w-4 h-4" />
                                <strong>Penalty:</strong> {req.penalty}
                              </div>
                            )}
                          </div>

                          {/* Expandable description */}
                          {req.description && (
                            <div className="mt-3">
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => toggleCard(req.id)}
                              >
                                {expandedCards.has(req.id) ? (
                                  <>
                                    <ChevronUp className="w-4 h-4 mr-1" />
                                    Hide Details
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-4 h-4 mr-1" />
                                    Show Details
                                  </>
                                )}
                              </button>
                              
                              {expandedCards.has(req.id) && (
                                <div className="mt-2 p-3 bg-base-300 rounded-lg">
                                  <p className="text-sm text-base-content/80">
                                    {req.description}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col gap-2 min-w-[140px]">
                          {req.sourceUrl && (
                            <a
                              href={req.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-outline"
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              View Source
                            </a>
                          )}
                          {req.formNumber && (
                            <button 
                              className="btn btn-sm btn-ghost"
                              title={`Copy: ${req.formNumber}`}
                              onClick={() => {
                                navigator.clipboard.writeText(req.formNumber);
                              }}
                            >
                              Copy Form
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* No results message */}
        {filteredRequirements.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-base-content/30 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-base-content/60">
              No requirements found matching your search
            </h3>
          </div>
        )}
      </div>
    </div>
  );
};