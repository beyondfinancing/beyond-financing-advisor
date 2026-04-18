import { LOAN_PROGRAMS } from "@/data/lenders"

export function matchPrograms({
  credit,
  ltv,
  occupancy,
}: {
  credit: number
  ltv: number
  occupancy: string
}) {
  return LOAN_PROGRAMS.filter((program) => {
    return (
      credit >= program.minCredit &&
      ltv <= program.maxLtv &&
      program.occupancy.includes(occupancy)
    )
  })
}
