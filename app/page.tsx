export default function Home() {
  return (
    <main className="min-h-screen bg-white text-[#263366]">
      <section className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 inline-flex items-center rounded-full border border-[#263366]/15 bg-[#F1F3F8] px-4 py-2 text-sm font-medium text-[#263366]">
          Beyond Financing • Mortgage Advisor
        </div>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Connect With a Mortgage Advisor — Instantly
        </h1>

        <p className="mt-5 max-w-2xl text-lg leading-8 text-[#263366]/80">
          Get personalized mortgage guidance in minutes. Powered by smart technology and reviewed by a licensed professional.
        </p>

        <p className="mt-3 text-sm text-[#263366]/70">
          English • Português • Español
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          <span className="rounded-full bg-[#F1F3F8] px-4 py-2">No commitment</span>
          <span className="rounded-full bg-[#F1F3F8] px-4 py-2">Real advisor</span>
          <span className="rounded-full bg-[#F1F3F8] px-4 py-2">100% confidential</span>
        </div>

        <div className="mt-10 w-full max-w-2xl rounded-2xl border border-[#263366]/10 bg-white p-4 shadow-sm">
          <div className="rounded-xl border border-[#263366]/10 bg-[#F8FAFC] p-4 text-left text-sm text-[#263366]/75">
            Describe your situation here. In the next step, we’ll turn this into a real chat experience.
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button className="rounded-full border border-[#263366]/15 px-4 py-2 text-sm hover:bg-[#F1F3F8]">
              I’m self-employed — can I buy a home?
            </button>
            <button className="rounded-full border border-[#263366]/15 px-4 py-2 text-sm hover:bg-[#F1F3F8]">
              First-time buyer — where do I start?
            </button>
            <button className="rounded-full border border-[#263366]/15 px-4 py-2 text-sm hover:bg-[#F1F3F8]">
              I want to get pre-approved
            </button>
          </div>
        </div>

        <div className="mt-8">
          <a
            href="#"
            className="inline-flex rounded-xl border border-[#263366] px-6 py-3 text-sm font-semibold text-[#263366] transition hover:bg-[#263366] hover:text-white"
          >
            Start Pre-Approval
          </a>
        </div>

        <p className="mt-6 max-w-2xl text-xs leading-6 text-[#263366]/60">
          This tool provides general information and does not constitute a loan approval or commitment to lend. All mortgage applications are subject to review and approval by a licensed Mortgage Loan Originator.
        </p>
      </section>
    </main>
  );
}
