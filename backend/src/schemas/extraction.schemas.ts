// Pydantic-style schemas for Firecrawl Extract API
// These schemas define structured data extraction from government compliance pages

export const ComplianceRequirementSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "The official name of the compliance requirement"
    },
    description: {
      type: "string",
      description: "Detailed description of what the requirement entails"
    },
    applicability: {
      type: "object",
      properties: {
        businessTypes: {
          type: "array",
          items: { type: "string" },
          description: "Types of businesses this applies to"
        },
        employeeThreshold: {
          type: "number",
          description: "Minimum number of employees for requirement to apply"
        },
        revenueThreshold: {
          type: "number",
          description: "Minimum annual revenue for requirement to apply"
        },
        industries: {
          type: "array",
          items: { type: "string" },
          description: "Specific industries or NAICS codes"
        }
      }
    },
    deadlines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Type of deadline (annual, quarterly, monthly, one-time)"
          },
          date: {
            type: "string",
            description: "Specific date or recurring schedule"
          },
          description: {
            type: "string",
            description: "What needs to be done by this deadline"
          }
        }
      }
    },
    forms: {
      type: "array",
      items: {
        type: "object",
        properties: {
          formNumber: {
            type: "string",
            description: "Official form number (e.g., Form 941, W-2)"
          },
          formName: {
            type: "string",
            description: "Official name of the form"
          },
          url: {
            type: "string",
            description: "Direct URL to download or access the form"
          }
        }
      }
    },
    penalties: {
      type: "array",
      items: {
        type: "object",
        properties: {
          violationType: {
            type: "string",
            description: "Type of violation"
          },
          minPenalty: {
            type: "number",
            description: "Minimum penalty amount in USD"
          },
          maxPenalty: {
            type: "number",
            description: "Maximum penalty amount in USD"
          },
          description: {
            type: "string",
            description: "Details about the penalty"
          }
        }
      }
    },
    citations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Type of citation (CFR, State Code, Local Ordinance)"
          },
          reference: {
            type: "string",
            description: "Specific citation reference (e.g., 29 CFR 1910.1200)"
          },
          title: {
            type: "string",
            description: "Title or name of the regulation"
          },
          url: {
            type: "string",
            description: "Direct URL to the legal text"
          }
        }
      }
    },
    fees: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Type of fee (registration, license, permit)"
          },
          amount: {
            type: "number",
            description: "Fee amount in USD"
          },
          frequency: {
            type: "string",
            description: "How often the fee is charged (annual, one-time, etc.)"
          }
        }
      }
    },
    contactInfo: {
      type: "object",
      properties: {
        agency: {
          type: "string",
          description: "Name of the responsible agency"
        },
        phone: {
          type: "string",
          description: "Contact phone number"
        },
        email: {
          type: "string",
          description: "Contact email address"
        },
        website: {
          type: "string",
          description: "Official website for more information"
        },
        address: {
          type: "string",
          description: "Physical mailing address if applicable"
        }
      }
    }
  },
  required: ["name", "description"]
};

export const GovernmentPageExtractionSchema = {
  type: "object",
  properties: {
    pageType: {
      type: "string",
      description: "Type of government page (federal, state, local, agency)"
    },
    agency: {
      type: "string",
      description: "Government agency that owns this page"
    },
    lastUpdated: {
      type: "string",
      description: "When the page was last updated"
    },
    requirements: {
      type: "array",
      items: ComplianceRequirementSchema,
      description: "List of compliance requirements found on this page"
    },
    relatedLinks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Link text or title"
          },
          url: {
            type: "string",
            description: "URL of the related resource"
          },
          description: {
            type: "string",
            description: "Brief description of what the link contains"
          }
        }
      },
      description: "Related resources and links"
    },
    announcements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Announcement title"
          },
          date: {
            type: "string",
            description: "Date of announcement"
          },
          content: {
            type: "string",
            description: "Announcement content"
          },
          importance: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
            description: "Importance level"
          }
        }
      },
      description: "Recent announcements or updates"
    }
  }
};

export const BusinessLicenseSchema = {
  type: "object",
  properties: {
    licenseName: {
      type: "string",
      description: "Name of the license or permit"
    },
    issuingAuthority: {
      type: "string",
      description: "Agency or department that issues this license"
    },
    description: {
      type: "string",
      description: "What this license is for"
    },
    requirements: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Requirements to obtain this license"
    },
    applicationProcess: {
      type: "array",
      items: {
        type: "object",
        properties: {
          step: {
            type: "number",
            description: "Step number"
          },
          description: {
            type: "string",
            description: "What to do in this step"
          },
          timeEstimate: {
            type: "string",
            description: "Estimated time for this step"
          }
        }
      }
    },
    fees: {
      type: "object",
      properties: {
        applicationFee: {
          type: "number",
          description: "Initial application fee"
        },
        renewalFee: {
          type: "number",
          description: "Renewal fee"
        },
        otherFees: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              amount: { type: "number" }
            }
          }
        }
      }
    },
    renewalPeriod: {
      type: "string",
      description: "How often the license needs renewal"
    },
    processingTime: {
      type: "string",
      description: "Typical processing time for application"
    },
    requiredDocuments: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Documents needed for application"
    }
  }
};

export const TaxRequirementSchema = {
  type: "object",
  properties: {
    taxType: {
      type: "string",
      description: "Type of tax (income, sales, payroll, property, etc.)"
    },
    taxingAuthority: {
      type: "string",
      description: "Federal, state, or local authority"
    },
    description: {
      type: "string",
      description: "Description of the tax requirement"
    },
    taxRates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          bracket: {
            type: "string",
            description: "Income bracket or category"
          },
          rate: {
            type: "number",
            description: "Tax rate as percentage"
          },
          effectiveDate: {
            type: "string",
            description: "When this rate takes effect"
          }
        }
      }
    },
    filingDeadlines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          formNumber: {
            type: "string",
            description: "Tax form number"
          },
          deadline: {
            type: "string",
            description: "Filing deadline"
          },
          frequency: {
            type: "string",
            description: "How often to file (annual, quarterly, monthly)"
          }
        }
      }
    },
    paymentSchedule: {
      type: "string",
      description: "When tax payments are due"
    },
    exemptions: {
      type: "array",
      items: {
        type: "string"
      },
      description: "Available exemptions or deductions"
    },
    registrationRequired: {
      type: "boolean",
      description: "Whether registration is required"
    },
    registrationProcess: {
      type: "string",
      description: "How to register for this tax"
    },
    penalties: {
      type: "object",
      properties: {
        lateFiling: {
          type: "string",
          description: "Penalty for late filing"
        },
        latePayment: {
          type: "string",
          description: "Penalty for late payment"
        },
        underpayment: {
          type: "string",
          description: "Penalty for underpayment"
        }
      }
    }
  }
};

// Helper function to select appropriate schema based on URL or content
export function selectExtractionSchema(url: string, intent?: string): any {
  const lowerUrl = url.toLowerCase();
  const lowerIntent = intent?.toLowerCase() || "";

  // Tax-related pages
  if (lowerUrl.includes("irs.gov") || lowerIntent.includes("tax") || lowerIntent.includes("941") || lowerIntent.includes("w-2")) {
    return TaxRequirementSchema;
  }

  // License and permit pages
  if (lowerIntent.includes("license") || lowerIntent.includes("permit") || lowerUrl.includes("license")) {
    return BusinessLicenseSchema;
  }

  // Default to general compliance schema
  return GovernmentPageExtractionSchema;
}

// Schema for batch extraction results
export const BatchExtractionResultSchema = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "Source URL"
    },
    extractedAt: {
      type: "string",
      description: "Timestamp of extraction"
    },
    data: {
      type: "object",
      description: "Extracted structured data based on the schema used"
    },
    schema: {
      type: "string",
      description: "Name of the schema used for extraction"
    },
    confidence: {
      type: "number",
      description: "Confidence score of extraction (0-1)"
    }
  }
};