export type LoanProgram = {
  id: string
  name: string
  lender: string
  minCredit: number
  maxLtv: number
  minIncome?: number
  maxDti?: number
  propertyTypes: string[]
  occupancy: string[]
  notes: string
}

export const LOAN_PROGRAMS: LoanProgram[] = [
  {
    id: "fnba-dscr",
    name: "DSCR Investor Program",
    lender: "FNBA",
    minCredit: 660,
    maxLtv: 80,
    propertyTypes: ["1-4 unit"],
    occupancy: ["investment"],
    notes: "No income verification, DSCR-based approval"
  },
  {
    id: "fnba-bank-statement",
    name: "12-Month Bank Statement",
    lender: "FNBA",
    minCredit: 620,
    maxLtv: 85,
    propertyTypes: ["1-4 unit"],
    occupancy: ["primary", "investment"],
    notes: "Self-employed borrower using bank statements"
  },
  {
    id: "conventional-30",
    name: "Conventional 30-Year Fixed",
    lender: "Agency",
    minCredit: 620,
    maxLtv: 97,
    propertyTypes: ["1-4 unit"],
    occupancy: ["primary"],
    notes: "Standard Fannie/Freddie program"
  }
]
