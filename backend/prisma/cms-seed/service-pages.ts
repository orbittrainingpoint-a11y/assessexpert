// Service pages for the AssessExpert marketing site.
//
// Each page is seeded as a CmsPage row that the dynamic
// /services/[slug]/page.tsx route renders with a rich layout. The
// content schema is consistent across all service pages so the renderer
// can be a single template.
//
// Shape (stored as JSON in CmsPage.content):
//   heroBadge, heroTitle, heroHighlight, heroSubtitle
//   intro:    80-100 word answer-style summary (AEO snippet)
//   sections: { title, body }[]   — main editorial sections
//   features: { title, description }[]  — feature cards
//   faqs:     { question, answer }[]
//   ctaTitle, ctaSubtitle

export interface ServicePageSeed {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  keywords: string[]
  content: {
    heroBadge: string
    heroTitle: string
    heroHighlight: string
    heroSubtitle: string
    intro: string
    sections: { title: string; body: string }[]
    features: { title: string; description: string }[]
    faqs: { question: string; answer: string }[]
    ctaTitle: string
    ctaSubtitle: string
  }
}

const COMMON_CTA = {
  title: 'Ready to evaluate your candidates with evidence?',
  subtitle: 'Book a demo with our team. We will configure an assessment for your highest-volume role and show you the candidate experience, the proctor dashboard, and the report your hiring managers will receive.',
}

export const SERVICE_PAGES: ServicePageSeed[] = [
  // 1
  {
    slug: 'technical-assessment-platform',
    title: 'Technical Assessment Platform',
    metaTitle: 'Technical Assessment Platform | AssessExpert',
    metaDescription: 'A technical assessment platform that tests applicants on real job skills, scores them objectively, and produces reports your hiring managers will read.',
    keywords: ['technical assessment platform', 'skills assessment software', 'pre-employment testing'],
    content: {
      heroBadge: 'Platform',
      heroTitle: 'Technical Assessment',
      heroHighlight: 'Platform',
      heroSubtitle: 'Test applicants on real job skills before any interview. Score the result objectively. Hand the hiring manager a report that answers the only question that matters.',
      intro: 'AssessExpert is a technical assessment platform built for corporate hiring. It delivers role-specific MCQ banks and practical tasks, monitors sessions with AI plus human proctors, and produces structured reports — so hiring teams can shortlist candidates based on demonstrated ability, not CV polish.',
      sections: [
        {
          title: 'Why hiring teams move to a platform',
          body: '<p>Without a platform, every promising CV becomes an interview slot. Most of those slots are wasted on candidates who cannot do the work. The platform sits between CV screen and recruiter call, qualifies who passes, and protects the rest of your funnel from noise.</p><p>The result is fewer interviews, higher per-interview signal, and faster time-to-hire.</p>'
        },
        {
          title: 'Two-phase assessment as standard',
          body: '<p>Every assessment runs in two phases. The MCQ phase tests breadth — 25 questions from a 500-question role-specific bank, Fisher-Yates shuffled so no two papers are alike. The practical phase tests depth — one 60-minute task graded against a fixed rubric.</p><p>Together they produce signal no single-phase test can match.</p>'
        },
        {
          title: 'Proctored, but humanly',
          body: '<p>AI watches face, gaze, audio, and tab switches. A certified proctor reviews every flag in context before the report publishes. AssessExpert does not auto-publish reports — a human always signs off.</p><p>The integrity signal goes into the report so your hiring manager can read it at a glance.</p>'
        },
        {
          title: 'Coverage across industries',
          body: '<p>AssessExpert covers engineering and construction, IT, finance, HR, design, operations, data, administration, and custom roles built by our Exam Setup team. The same platform shape works whether you are hiring an AutoCAD draftsman, a Python developer, or a financial analyst.</p>'
        }
      ],
      features: [
        { title: '500-question banks per role', description: 'Each assessment type holds 500 calibrated questions. The candidate sees 25, shuffled, with no leakage between sessions.' },
        { title: 'Practical task per role', description: 'A 60-minute hands-on task — drawings, code, spreadsheets, files — scored against a structured rubric.' },
        { title: 'AI proctoring + human review', description: 'Face, gaze, audio, and tab-switch monitoring with a certified proctor reviewing every flag.' },
        { title: 'Manager-ready reports', description: 'Lead with the recommendation. Show the breakdown. Include the proctor note. One screen, decision-ready.' },
        { title: 'Multi-tenant isolation', description: 'Your workspace is your workspace. Candidates, reports, and branding never cross client boundaries.' },
        { title: 'Custom roles in 2-3 weeks', description: 'Our Exam Setup team builds bespoke question banks and practical tasks to your exact specification.' }
      ],
      faqs: [
        { question: 'What is a technical assessment platform?', answer: 'A technical assessment platform delivers structured tests to job applicants and produces a comparable score. AssessExpert runs MCQ + practical phases with proctoring and human-reviewed reports.' },
        { question: 'How long does an assessment take?', answer: '90 minutes total — 30 for the MCQ phase, 60 for the practical, plus a short pre-flight check.' },
        { question: 'Can we use it for any job role?', answer: 'Yes. Pre-built coverage spans engineering, IT, finance, HR, design, operations, and data. Custom roles are built by our Exam Setup team in two to three weeks.' },
        { question: 'How is it different from generic testing tools?', answer: 'AssessExpert pairs MCQs with role-specific practical tasks, includes a human proctor review step, and never auto-publishes reports.' }
      ],
      ctaTitle: COMMON_CTA.title,
      ctaSubtitle: COMMON_CTA.subtitle,
    }
  },

  // 2
  {
    slug: 'pre-employment-testing-software',
    title: 'Pre-Employment Testing Software',
    metaTitle: 'Pre-Employment Testing Software | AssessExpert',
    metaDescription: 'Pre-employment testing software that filters unqualified applicants before they reach an interview slot. Structured, proctored, and built for serious hiring teams.',
    keywords: ['pre employment testing software', 'job assessment test', 'screening software'],
    content: {
      heroBadge: 'Testing',
      heroTitle: 'Pre-Employment',
      heroHighlight: 'Testing Software',
      heroSubtitle: 'Screen candidates before the recruiter call. Stop spending manager time on candidates who cannot do the work.',
      intro: 'Pre-employment testing software qualifies applicants against real job skills before any interview is scheduled. AssessExpert delivers role-specific tests with anti-cheat proctoring and rubric scoring, then hands the hiring team a structured report so the only candidates who reach interview are the ones who can do the work.',
      sections: [
        {
          title: 'The cost of skipping this step',
          body: '<p>A bad mid-level hire costs the company 6-9 months of salary in lost productivity, replacement recruiting, and team morale. At a $60k role that is $30k-$45k per bad hire. Stop one a quarter and the platform pays for itself many times over.</p>'
        },
        {
          title: 'What testing filters out',
          body: '<p>Inflated experience claims. Confident interviewees with shallow technical depth. Skill-CV mismatch that would otherwise be caught at month three. Candidates who present well but ship poorly.</p><p>What it does not catch — cultural fit, motivation, team dynamics — is what the interview is for.</p>'
        },
        {
          title: 'Where the test belongs in the funnel',
          body: '<p>Right after CV screen, before the recruiter call. That order saves the most manager time and is fairer to candidates than a screening call that ends in silent rejection.</p><p>Candidates who pass earn the interview. Candidates who fail receive a polite decline with a clear reason — better candidate experience than the ghosting most receive today.</p>'
        }
      ],
      features: [
        { title: 'Role-specific test delivery', description: 'No generic tests. Each role pulls from a 500-question bank built or calibrated for that role.' },
        { title: 'Anti-cheat by design', description: 'Randomised question order, time control, proctoring, and human review of flagged sessions.' },
        { title: 'Pass-fail rubrics, not vibes', description: 'Set the pass mark against current top performers. The platform tiers candidates against the threshold.' },
        { title: 'Clean candidate experience', description: 'Pre-flight network check, clear instructions, mobile-friendly delivery. Candidates respect a clean test.' }
      ],
      faqs: [
        { question: 'How long is the test?', answer: '30-90 minutes depending on whether you include the practical phase. We recommend including it.' },
        { question: 'Will candidates drop off?', answer: 'A small percentage. Those who refuse a 60-minute test are usually the ones who would not have lasted in the role anyway.' },
        { question: 'Can we customise the test per role?', answer: 'Yes. Custom banks are built by our Exam Setup team in two to three weeks.' }
      ],
      ctaTitle: COMMON_CTA.title,
      ctaSubtitle: COMMON_CTA.subtitle,
    }
  },

  // 3
  {
    slug: 'technical-interview-assessment',
    title: 'Technical Interview Assessment',
    metaTitle: 'Technical Interview Assessment Service | AssessExpert',
    metaDescription: 'Conduct structured technical interview assessments without overloading your senior team. Managed delivery, proctored sessions, and a calibrated report.',
    keywords: ['technical interview assessment', 'technical evaluation', 'structured interview'],
    content: {
      heroBadge: 'Managed Service',
      heroTitle: 'Technical Interview',
      heroHighlight: 'Assessment',
      heroSubtitle: 'When your senior team does not have time to interview every promising candidate, let AssessExpert run the technical evaluation.',
      intro: 'AssessExpert delivers managed technical interview assessments for companies whose senior engineers, architects, or analysts are too stretched to interview every qualified applicant. We run the assessment, our certified proctors review the session, and you receive a calibrated report so your team makes the final hiring call with confidence.',
      sections: [
        {
          title: 'When this service makes sense',
          body: '<p>Volume hiring sprints where in-house technical capacity is the bottleneck. Specialist roles your internal team cannot credibly assess. Compliance contexts where an independent assessor reduces bias risk.</p><p>It does not make sense for strategic senior hires where cultural and judgement signal matters most — those stay with your team.</p>'
        },
        {
          title: 'How calibration works',
          body: '<p>Before going live, we run one to two calibration sessions with your hiring managers. We score sample candidates together, align rubrics, and agree what passes versus what does not. Once calibrated, our scoring matches what your team would have produced — without the senior-team time cost.</p>'
        },
        {
          title: 'What you receive per candidate',
          body: '<p>A structured report with the recommendation up top, the rubric-by-rubric breakdown, the proctor integrity note, and the recorded session for review. Your team uses the report to schedule final-round interviews or to decline with cause.</p>'
        }
      ],
      features: [
        { title: 'Calibrated rubrics', description: 'Your hiring bar, encoded in the rubric. Not a generic standard.' },
        { title: 'Certified proctors', description: 'Sessions run and reviewed by AssessExpert-certified proctors with role-specific training.' },
        { title: 'Recorded sessions', description: 'Full recording stored in your workspace for review, second opinions, or compliance.' },
        { title: 'Borderline escalation path', description: 'Borderline candidates flagged for your team to review rather than auto-decisioned.' }
      ],
      faqs: [
        { question: 'Will the outsourced assessment match how our team would score?', answer: 'After calibration, yes. We score sample candidates together until rubrics align before going live.' },
        { question: 'Can we still interview the candidates ourselves?', answer: 'Of course. The assessment qualifies who reaches your interview slot; final decisions stay with your team.' },
        { question: 'How quickly can a session be turned around?', answer: 'Reports typically delivered within 1-2 business days of the candidate completing the session.' }
      ],
      ctaTitle: COMMON_CTA.title,
      ctaSubtitle: COMMON_CTA.subtitle,
    }
  },

  // 4
  {
    slug: 'online-assessment-platform',
    title: 'Online Assessment Platform',
    metaTitle: 'Online Assessment Platform for Hiring | AssessExpert',
    metaDescription: 'Online assessment platform built for serious corporate hiring — proctored, role-specific, with reports your managers will actually read.',
    keywords: ['online assessment platform for hiring', 'online testing', 'assessment software'],
    content: {
      heroBadge: 'Platform',
      heroTitle: 'Online Assessment',
      heroHighlight: 'Platform',
      heroSubtitle: 'Deliver structured technical assessments to candidates anywhere. Proctored sessions, role-specific banks, and reports your managers will actually open.',
      intro: 'AssessExpert is a fully online assessment platform — candidates take the test from anywhere on any device, sessions are proctored end-to-end with AI plus human review, and reports are delivered to your hiring team in your workspace. Built for corporate hiring at scale without losing per-candidate signal quality.',
      sections: [
        {
          title: 'Why online does not mean weaker',
          body: '<p>An online assessment, done properly, is at least as defensible as an on-site one — and a lot more scaleable. The defensibility comes from layered proctoring, controlled session delivery, and human review of every flag. Without those, online assessments earn their bad reputation.</p>'
        },
        {
          title: 'What the candidate experiences',
          body: '<p>A clear invitation email. A pre-flight check that confirms camera, microphone, and bandwidth. Identity confirmation against ID. The assessment itself, delivered one question at a time. A polite close at the end. No drama, no surprises.</p>'
        },
        {
          title: 'What your hiring team experiences',
          body: '<p>A workspace where every candidate session, recording, and report is filed by role. Live monitoring of in-progress sessions. A clean tier of A/B/C candidates after each batch closes. Reports that fit on one screen.</p>'
        }
      ],
      features: [
        { title: 'Mobile and desktop delivery', description: 'Candidates can take the assessment on any modern device. The proctoring works the same on mobile.' },
        { title: 'Bandwidth tolerance', description: 'Pre-flight checks identify low-bandwidth candidates; the session adapts to keep proctoring continuous.' },
        { title: 'Multi-language support', description: 'Native Arabic and English delivery, with right-to-left layout where required.' },
        { title: 'Live session dashboard', description: 'Watch in-progress sessions if you need to. Most teams check post-session reports instead.' }
      ],
      faqs: [
        { question: 'Is the platform mobile-friendly?', answer: 'Yes. Most candidates take the MCQ phase on mobile and the practical on desktop. Both are supported.' },
        { question: 'What happens if the candidate loses internet during the assessment?', answer: 'Session state is preserved server-side. The candidate resumes from where they were, with the proctor notified.' },
        { question: 'Can we restrict access by region or IP?', answer: 'Yes, configurable per organisation.' }
      ],
      ctaTitle: COMMON_CTA.title,
      ctaSubtitle: COMMON_CTA.subtitle,
    }
  },

  // 5
  {
    slug: 'corporate-assessment-system',
    title: 'Corporate Assessment System',
    metaTitle: 'Corporate Assessment System | AssessExpert',
    metaDescription: 'A corporate assessment system that handles enterprise hiring volume with the per-candidate signal of a bespoke evaluation. Multi-tenant, audited, and scaleable.',
    keywords: ['corporate assessment system', 'enterprise hiring', 'HR assessment platform'],
    content: {
      heroBadge: 'Enterprise',
      heroTitle: 'Corporate Assessment',
      heroHighlight: 'System',
      heroSubtitle: 'Designed for enterprises that need consistent assessment across business units, regions, and hiring volumes — without losing the signal of a bespoke evaluation.',
      intro: 'AssessExpert is a corporate assessment system built for enterprises. It supports multiple business units in isolated workspaces, audited access for compliance teams, role-specific banks across every function you hire for, and reporting consistent enough to compare candidates across regions and time.',
      sections: [
        {
          title: 'Why enterprise hiring is harder',
          body: '<p>Enterprises hire across functions, regions, and seniority levels every day. A platform that fits one role family fails the rest. The corporate system must handle every role with consistent rigour while letting each business unit operate within its own workspace.</p>'
        },
        {
          title: 'Built-in compliance footprint',
          body: '<p>Every action — schedule, invite, score, publish — is captured in a tamper-evident audit log. Reviewers can reconstruct exactly what happened during any hiring decision, which matters for regulated industries and during disputes.</p>'
        },
        {
          title: 'Multi-region delivery',
          body: '<p>Run hiring in Dubai, London, and Singapore from one platform. Candidates see the right language; reports stay in the right workspace; proctoring runs in the candidate\'s time zone with regional support coverage.</p>'
        }
      ],
      features: [
        { title: 'Workspace per business unit', description: 'Each BU has its own workspace with isolated data, branding, and access control.' },
        { title: 'Tamper-evident audit log', description: 'SHA-256 chained audit records for every hiring action. Compliance-ready.' },
        { title: 'Role-based access control', description: 'Recruiter, Hiring Manager, Proctor, Compliance — each role sees what they need, nothing more.' },
        { title: 'Cross-region reporting', description: 'Roll up candidate metrics across regions for executive view; drill back down to the candidate session.' },
        { title: 'Single sign-on ready', description: 'SAML / OIDC integration with your corporate identity provider available on enterprise plans.' },
        { title: 'Data residency options', description: 'Storage region selectable for regulated workloads.' }
      ],
      faqs: [
        { question: 'How do business units stay isolated?', answer: 'Each business unit operates in its own tenant. Candidate data, reports, and configuration do not cross tenant boundaries — enforced at the database layer.' },
        { question: 'Is there an SLA on platform availability?', answer: 'Enterprise plans include a defined SLA. Discuss specifics during onboarding.' },
        { question: 'Can we integrate with our ATS?', answer: 'Yes — webhook and API integrations are available for major ATS platforms.' }
      ],
      ctaTitle: COMMON_CTA.title,
      ctaSubtitle: COMMON_CTA.subtitle,
    }
  },

  // 6
  {
    slug: 'custom-assessment-tests',
    title: 'Custom Assessment Tests',
    metaTitle: 'Custom Assessment Tests | AssessExpert',
    metaDescription: 'Custom assessment tests built to your exact role specification by AssessExpert\'s Exam Setup team. Two to three weeks from brief to live assessment.',
    keywords: ['custom assessment tests', 'bespoke testing', 'role-specific assessment'],
    content: {
      heroBadge: 'Custom Build',
      heroTitle: 'Custom Assessment',
      heroHighlight: 'Tests',
      heroSubtitle: 'When off-the-shelf tests are too generic, we build the assessment to your exact role specification — question bank, practical task, and rubric.',
      intro: 'AssessExpert\'s Exam Setup team builds custom assessment tests for roles that off-the-shelf banks do not cover well. We work with your subject matter expert to design 500-question banks, calibrate a practical task, and write the scoring rubric. Typical build time is two to three weeks.',
      sections: [
        {
          title: 'When to commission a custom test',
          body: '<p>Your role involves proprietary tools, internal workflows, regulatory frameworks unique to your industry, or a combination of skills that no off-the-shelf test covers. The generic test would under-discriminate — too many candidates would pass and you would learn nothing.</p>'
        },
        {
          title: 'How the build process works',
          body: '<p>Week 1: skill mapping with your SME — what does the role actually require? Week 2: question writing and practical design. Week 3: SME review, calibration against your current team, and integrity review.</p><p>The bank stays private to your workspace. We do not share custom questions across clients.</p>'
        },
        {
          title: 'What you get at the end',
          body: '<p>A 500-question bank tagged by domain and difficulty. A 60-minute practical task with a scoring rubric. A pass-mark calibrated against your top current performers. Documentation your team can use for future role iterations.</p>'
        }
      ],
      features: [
        { title: 'SME-driven question writing', description: 'Your subject matter expert drives the skill map; our team handles the writing and calibration.' },
        { title: 'Private banks', description: 'Custom banks stay in your workspace and are not shared with other clients.' },
        { title: 'Calibration against your team', description: 'Pass-mark set so your current top performers score in the expected range.' },
        { title: 'Iteration support', description: 'After three months of live use, we revisit the bank and tighten weak questions.' }
      ],
      faqs: [
        { question: 'How long does a custom build take?', answer: 'Two to three weeks from kickoff to live, assuming SME availability for two short review sessions.' },
        { question: 'How much SME time is required?', answer: 'Around 4-6 hours total across the build: skill mapping, question review, and calibration.' },
        { question: 'Can we update the bank later?', answer: 'Yes. Banks are versioned; updates do not affect candidates who already took the test.' }
      ],
      ctaTitle: COMMON_CTA.title,
      ctaSubtitle: COMMON_CTA.subtitle,
    }
  },

  // 7
  {
    slug: 'coding-assessment-platform',
    title: 'Coding Assessment Platform',
    metaTitle: 'Coding Assessment Platform | AssessExpert',
    metaDescription: 'Coding assessment platform with role-specific banks, anti-cheat proctoring, and transparent rubrics that engineering leads can defend.',
    keywords: ['coding assessment platform', 'developer assessment', 'engineer hiring'],
    content: {
      heroBadge: 'Engineering Hiring',
      heroTitle: 'Coding Assessment',
      heroHighlight: 'Platform',
      heroSubtitle: 'Test developers on real-world coding tasks, not whiteboard puzzles. Reading code, debugging, system design — closer to the actual job.',
      intro: 'AssessExpert\'s coding assessment platform tests developers on tasks closer to the real job than the standard whiteboard interview — reading and modifying existing code, debugging broken tests, and small system design exercises. Sessions are proctored, scoring is rubric-driven, and reports are written so engineering leads can defend the decision.',
      sections: [
        {
          title: 'What we test instead of LeetCode',
          body: '<p>Reading and modifying existing code — closer to real engineering work than greenfield problems. Debugging a broken test suite — a daily skill that nobody else screens for. Designing a small system with realistic constraints — architecture sense. Communication about technical tradeoffs — how the candidate explains, not just what they say.</p>'
        },
        {
          title: 'Language and stack coverage',
          body: '<p>Python, JavaScript/TypeScript, Java, Go, C#, Ruby, PHP, SQL, and shell. Frontend (React) and backend stacks. Database design. DevOps and infrastructure topics. Custom stacks supported through our Exam Setup team.</p>'
        },
        {
          title: 'AI-tool detection',
          body: '<p>Candidates pasting questions into AI tools generate distinctive signal — tab switches, typing patterns inconsistent with reading, abrupt answer arrivals. AssessExpert flags these for review rather than auto-disqualifying. A human proctor makes the final call.</p>'
        }
      ],
      features: [
        { title: 'Real code, not puzzles', description: 'Tasks designed by working engineers to mirror daily work, not interview folklore.' },
        { title: 'Anti-cheat for AI tools', description: 'Detection layers that flag AI-tool usage for human review.' },
        { title: 'Defensible rubrics', description: 'Transparent scoring criteria your engineering leads can read and trust.' },
        { title: 'Stack-aligned questions', description: 'Banks per stack and difficulty level — junior, mid, senior.' }
      ],
      faqs: [
        { question: 'Should candidates be allowed to use AI tools in the test?', answer: 'If they will use them on the job, yes — and the test difficulty is adjusted accordingly. We support both modes.' },
        { question: 'Do you support pair programming?', answer: 'For final-round interviews, yes. The initial assessment is candidate-led.' },
        { question: 'Can we use our own coding tasks?', answer: 'Yes. Bring tasks and we will configure them in the platform.' }
      ],
      ctaTitle: COMMON_CTA.title,
      ctaSubtitle: COMMON_CTA.subtitle,
    }
  },

  // 8
  {
    slug: 'cad-bim-engineering-assessments',
    title: 'CAD, BIM and Engineering Assessment Tests',
    metaTitle: 'CAD, BIM, Engineering Assessment Tests | AssessExpert',
    metaDescription: 'Practical assessments for AutoCAD, Revit, BIM coordinators, MEP engineers, and structural designers. Software discipline tested by drawing production, not menu navigation.',
    keywords: ['AutoCAD assessment test', 'Revit assessment test', 'BIM assessment test', 'engineering candidate assessment'],
    content: {
      heroBadge: 'Engineering',
      heroTitle: 'CAD, BIM & Engineering',
      heroHighlight: 'Assessments',
      heroSubtitle: 'Test AutoCAD, Revit, BIM, MEP and structural candidates on what the job actually requires — drawing production, model discipline, coordination.',
      intro: 'AssessExpert\'s engineering assessment suite covers AutoCAD (L1 and L2), Revit, BIM coordination, MEP, structural, civil, and planning roles. Each role tests software discipline through a practical drawing or modelling task, not menu trivia — closer to the work the candidate will actually do.',
      sections: [
        {
          title: 'AutoCAD: testing what production drawings need',
          body: '<p>Layer management, blocks vs references, dimension styles, drawing setup, plot styles. The MCQ phase covers fundamentals. The practical asks the candidate to produce a finished drawing from a sketch and brief. Red flags — everything on layer 0, no dim styles, polylines where lines suffice — surface immediately.</p>'
        },
        {
          title: 'Revit: model discipline beats menu speed',
          body: '<p>Family creation, parametric thinking, shared coordinates, worksharing, view templates. The practical: model a small element, set up views, produce a sheet, in 60 minutes. Scoring weights model integrity (do schedules report correctly?) over rendering quality.</p>'
        },
        {
          title: 'BIM: coordination, not just modelling',
          body: '<p>BIM coordinator candidates receive a federated model with seeded clashes and produce a BCF report. Scoring covers clash classification, discipline-aware judgement, and the quality of the BCF notes a contractor would action.</p>'
        },
        {
          title: 'MEP, structural, civil, planning',
          body: '<p>Pre-built assessments for each. Custom roles built to your spec by our Exam Setup team in two to three weeks.</p>'
        }
      ],
      features: [
        { title: 'AutoCAD L1 and L2', description: 'Junior (supervised) vs independent producer — separate banks and harder practical tasks.' },
        { title: 'Revit modeller vs BIM coordinator', description: 'Different roles, different banks. Coordination skills tested separately from modelling.' },
        { title: 'Sandbox environment', description: 'Candidates work in a controlled sandbox to remove hardware variance from the result.' },
        { title: 'Discipline-aware scoring', description: 'A clash that matters scores higher than ten clashes that don\'t. Same for layer discipline and dimension hygiene.' }
      ],
      faqs: [
        { question: 'Do you cover non-Autodesk software?', answer: 'Yes — Bentley, OpenBIM workflows, MicroStation, and BricsCAD are available on request.' },
        { question: 'Can we run the test on the candidate\'s machine?', answer: 'Sandbox where possible — removes hardware variance. On-machine delivery available for senior roles.' },
        { question: 'How is rendering quality weighted?', answer: 'Low or not at all for production roles. Renders are not a hiring signal for modellers.' }
      ],
      ctaTitle: COMMON_CTA.title,
      ctaSubtitle: COMMON_CTA.subtitle,
    }
  },

  // 9
  {
    slug: 'candidate-reports-scoring',
    title: 'Candidate Reports and Scoring',
    metaTitle: 'Candidate Reports and Scoring | AssessExpert',
    metaDescription: 'Candidate scoring reports that lead with the recommendation, show the breakdown, include the proctor note, and never auto-publish.',
    keywords: ['candidate scoring reports', 'hiring reports', 'assessment scoring'],
    content: {
      heroBadge: 'Reports',
      heroTitle: 'Candidate Reports',
      heroHighlight: 'and Scoring',
      heroSubtitle: 'A report your hiring manager will actually read. Lead with the recommendation. Show the breakdown. Skip the vanity metrics.',
      intro: 'AssessExpert produces candidate reports designed to be scanned and acted on. Every report leads with a Hire / Consider / Decline recommendation, shows the section-by-section breakdown, includes the proctor\'s integrity note, and is signed off by a certified proctor before publishing. Auto-published reports are not allowed.',
      sections: [
        {
          title: 'What every report includes',
          body: '<ul><li>Recommendation: Strong hire / Consider / Decline, with one sentence of reasoning.</li><li>Section-level scores: MCQ breakdown by domain, practical breakdown by rubric criterion.</li><li>Integrity note: the proctor\'s summary of session integrity, in plain language.</li><li>Recorded session: available for review or second opinion.</li></ul>'
        },
        {
          title: 'What every report leaves out',
          body: '<p>Time spent per question. Percentile rank against everyone who ever took the test. Mouse movement metrics. Personality colour codes. Reports are stripped to what informs the hiring decision and nothing else.</p>'
        },
        {
          title: 'Why proctor sign-off is non-negotiable',
          body: '<p>AI flags are noisy. A platform that auto-disqualifies on AI flags rejects good candidates and creates legal risk. Every AssessExpert report is reviewed by a certified proctor before publishing. If the AI raised concerns, the proctor either explains them in the integrity note or dismisses them after review.</p>'
        }
      ],
      features: [
        { title: 'One-screen reports', description: 'Most managers see everything they need in a single screen, with full detail one click away.' },
        { title: 'Section breakdowns', description: 'See exactly where the candidate is strong and weak.' },
        { title: 'Integrity note', description: 'The proctor\'s plain-language summary of session integrity, included in every report.' },
        { title: 'Session recording', description: 'Available for second opinions or compliance review.' },
        { title: 'No auto-publish', description: 'A certified proctor signs off on every report before it reaches your team.' },
        { title: 'Exportable formats', description: 'PDF, JSON, and CSV exports for downstream systems.' }
      ],
      faqs: [
        { question: 'Can candidates see their report?', answer: 'Configurable per organisation. Many clients share a redacted version for transparency.' },
        { question: 'How long until the report is available?', answer: 'Typically within 1-2 business days of the candidate completing the session.' },
        { question: 'Can we customise the report template?', answer: 'Yes — branding and layout configurable for enterprise plans.' }
      ],
      ctaTitle: COMMON_CTA.title,
      ctaSubtitle: COMMON_CTA.subtitle,
    }
  },

  // 10
  {
    slug: 'recruitment-agency-assessment-platform',
    title: 'Recruitment Agency Assessment Platform',
    metaTitle: 'Assessment Platform for Recruitment Agencies | AssessExpert',
    metaDescription: 'Multi-tenant assessment platform for recruitment agencies. Submit candidates with structured assessment reports and command higher placement fees.',
    keywords: ['assessment system for recruitment agencies', 'recruitment agency tools', 'staffing platform'],
    content: {
      heroBadge: 'For Agencies',
      heroTitle: 'Recruitment Agency',
      heroHighlight: 'Assessment Platform',
      heroSubtitle: 'Submit candidates with structured assessment reports. Win more placements at higher fees by differentiating your CV submissions with evidence.',
      intro: 'AssessExpert\'s multi-tenant model lets recruitment agencies maintain a separate workspace per client. Submit each candidate with a structured assessment report alongside the CV — clients receive evidence, not just resumes, and agencies that work this way close placements faster at higher fees.',
      sections: [
        {
          title: 'The differentiation play',
          body: '<p>Your competition submits CVs. Submitting a CV plus a structured assessment report changes the conversation with the client. An assessment report says: "We tested this candidate against your role\'s required skills. Here is the evidence." That single addition often wins the placement.</p>'
        },
        {
          title: 'Workspace per client',
          body: '<p>Each client gets a separate workspace with their branding, their roles, and their candidate pool. Cross-contamination at the data layer is impossible. The client only sees what you choose to share.</p>'
        },
        {
          title: 'Higher fees justified',
          body: '<p>Agencies that submit assessment reports defend higher placement fees — typically 18-25% vs 12-15% — because the work product is genuinely more valuable. A bad placement is more expensive than a higher fee, and clients increasingly understand this.</p>'
        }
      ],
      features: [
        { title: 'Multi-tenant workspaces', description: 'One per client, with isolated data, branding, and access control.' },
        { title: 'White-label option', description: 'Configure your agency\'s branding on the candidate-facing assessment.' },
        { title: 'Candidate pool reuse', description: 'A candidate assessed for one role can be re-presented to other clients with the existing report.' },
        { title: 'Shareable redacted reports', description: 'Share polished versions of reports with clients; keep raw data private.' }
      ],
      faqs: [
        { question: 'Can we white-label the candidate-facing flow?', answer: 'Yes — branding configuration covers workspace name, colours, and logos on reports.' },
        { question: 'What if a client wants direct platform access?', answer: 'Configurable. Each client workspace can be opened to the client for self-service or kept agency-managed.' },
        { question: 'How is pricing structured for agencies?', answer: 'Per-assessment or per-seat models available. Discuss specifics during the demo.' }
      ],
      ctaTitle: COMMON_CTA.title,
      ctaSubtitle: COMMON_CTA.subtitle,
    }
  },

  // 11
  {
    slug: 'technical-testing-for-applicants',
    title: 'Technical Testing for Applicants',
    metaTitle: 'Technical Testing for Applicants | AssessExpert',
    metaDescription: 'Test applicants on real job skills before any interview. Structured, proctored, and fair across every candidate.',
    keywords: ['technical testing for applicants', 'applicant testing', 'candidate testing'],
    content: {
      heroBadge: 'Applicant Testing',
      heroTitle: 'Technical Testing',
      heroHighlight: 'for Applicants',
      heroSubtitle: 'Give every applicant the same structured chance to prove they can do the job. Faster than phone screens, fairer than gut-feel rejection.',
      intro: 'AssessExpert delivers structured technical testing to applicants in a controlled environment — same questions per role pool, same time limits, same scoring rubric. The result is a fair, defensible measure of ability that your hiring team can act on, without the time cost of interviewing everyone who looks promising on paper.',
      sections: [
        {
          title: 'Fairness by design',
          body: '<p>Every candidate for a role draws from the same 500-question bank, receives 25 shuffled questions, and has the same time limit. No two papers are identical; the difficulty mix is. That keeps the test resistant to leakage while being demonstrably fair across applicants.</p>'
        },
        {
          title: 'A controlled environment',
          body: '<p>Proctored sessions with face detection, gaze tracking, audio monitoring, and tab-switch detection — all reviewed by a human before any flag affects the report. Candidates get a controlled environment to demonstrate skill; you get a defensible measure.</p>'
        },
        {
          title: 'Respect for the candidate\'s time',
          body: '<p>The whole test runs in 90 minutes including pre-flight checks. Candidates can take it at a time they choose within an invitation window. The shorter the test, the less it interferes with their day and the more candidates complete it.</p>'
        }
      ],
      features: [
        { title: 'Same rules for everyone', description: 'Identical bank, time limit, and rubric across all applicants for a role.' },
        { title: 'Mobile-friendly delivery', description: 'Candidates take the test on whatever device they have.' },
        { title: 'Self-scheduled within window', description: 'Candidates pick their own start time within the invitation window.' },
        { title: 'Polite decline messaging', description: 'Failing candidates receive a structured decline rather than silence.' }
      ],
      faqs: [
        { question: 'How long is the test?', answer: '90 minutes including 30 MCQ + 60 practical + brief pre-flight check.' },
        { question: 'What devices are supported?', answer: 'Any modern desktop or mobile device with camera and microphone. Pre-flight check validates the setup.' },
        { question: 'Can candidates retake the test?', answer: 'Generally no — one valid attempt per role to preserve signal integrity. Exceptions handled case-by-case.' }
      ],
      ctaTitle: COMMON_CTA.title,
      ctaSubtitle: COMMON_CTA.subtitle,
    }
  },

  // 12
  {
    slug: 'assessment-platform-uae',
    title: 'Assessment Platform UAE',
    metaTitle: 'Assessment Platform UAE for GCC Hiring | AssessExpert',
    metaDescription: 'Assessment platform built for UAE and GCC hiring — bilingual Arabic/English, regional support hours, and local data residency options.',
    keywords: ['assessment platform UAE', 'GCC hiring', 'Dubai assessment platform'],
    content: {
      heroBadge: 'UAE & GCC',
      heroTitle: 'Assessment Platform',
      heroHighlight: 'UAE',
      heroSubtitle: 'Built in Dubai for UAE and wider GCC hiring. Bilingual Arabic/English delivery, regional support hours, and the structural fit that off-the-shelf North American platforms miss.',
      intro: 'AssessExpert is built by Orbit Training in Dubai for UAE and GCC corporate hiring. Bilingual Arabic/English candidate delivery, native right-to-left layout, regional support hours, and Exam Setup teams familiar with the regulatory frameworks that govern construction, oil and gas, healthcare, and finance hiring in the region.',
      sections: [
        {
          title: 'Bilingual by default',
          body: '<p>Many GCC roles require working comfort in both Arabic and English. AssessExpert supports Arabic and English candidate flows with consistent rubric scoring — same fairness criteria across languages. The candidate picks the language they\'re comfortable with at start.</p>'
        },
        {
          title: 'Diverse candidate pool support',
          body: '<p>GCC hiring pulls from South Asia, Levant, Africa, and Europe. The platform handles varying bandwidth, time zones, and device profiles — and mobile-friendly delivery means candidates can complete the test wherever they are.</p>'
        },
        {
          title: 'Regional support hours',
          body: '<p>Sales, support, and Exam Setup operate in GCC working hours. Implementation calls happen in your time zone, not yours-minus-eight. Custom builds don\'t stall waiting for North American business hours.</p>'
        },
        {
          title: 'Regulated industries',
          body: '<p>Construction, oil and gas, healthcare, and finance carry specific regulatory frameworks. Our Exam Setup team is familiar with the role frameworks common to these sectors and builds assessments that respect them.</p>'
        }
      ],
      features: [
        { title: 'Native Arabic UI', description: 'Right-to-left layout, Arabic-first proctoring instructions, and consistent rubric scoring across languages.' },
        { title: 'GCC timezone support', description: 'Sales and support in regional working hours.' },
        { title: 'Local data residency', description: 'Storage region options for regulated workloads.' },
        { title: 'Industry familiarity', description: 'Exam Setup team familiar with construction, energy, healthcare, and finance frameworks.' }
      ],
      faqs: [
        { question: 'Is the Arabic interface a translation or a native build?', answer: 'Native with right-to-left layout and Arabic-first proctoring instructions.' },
        { question: 'Do you support data residency in the UAE?', answer: 'Discuss specific residency requirements during onboarding — options available.' },
        { question: 'Can you handle hiring across multiple GCC countries from one workspace?', answer: 'Yes — multi-region delivery is core to the platform.' }
      ],
      ctaTitle: COMMON_CTA.title,
      ctaSubtitle: COMMON_CTA.subtitle,
    }
  },
]
