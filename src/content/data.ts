/**
 * Site content — single source of truth for every theme.
 * Facts are exact; phrasing is confident and concrete.
 */

import type { SiteContent } from './types'

export const siteContent: SiteContent = {
  identity: {
    name: 'Soubhik Ghosh',
    firstName: 'Soubhik',
    lastName: 'Ghosh',
    handle: 'soweak',
    role: 'AI/ML Engineer',
    tagline:
      'I build AI that ships: four years across Full Stack and AI/ML, from biometrics to LLM agents. 800+ people use it every day. Guitarist and tarot reader between deployments.',
    location: 'Bengaluru, India',
    email: '99ghoshsoubhik@gmail.com',
    github: 'https://github.com/so-weak',
    linkedin: 'https://www.linkedin.com/in/soweak',
    instagram: 'https://www.instagram.com/_so_weak_/',
    resumeUrl: '/resume/Soubhik-Ghosh-Resume.pdf',
    photoUrl: '/images/portrait.svg',
  },

  stats: [
    { label: 'years shipping production AI', value: '4+' },
    { label: 'daily users across the bank', value: '800+' },
    { label: 'face-recognition accuracy', value: '99.2%' },
    { label: 'recognition latency', value: '<100ms' },
    { label: 'documents answered over RAG', value: '27,000+' },
    { label: 'hallucination reduction', value: '40–60%' },
  ],

  sections: [
    { id: 'about', label: 'About' },
    { id: 'experience', label: 'Experience' },
    { id: 'projects', label: 'Projects' },
    { id: 'skills', label: 'Skills' },
    { id: 'awards', label: 'Awards' },
    { id: 'writing', label: 'Writing' },
    { id: 'contact', label: 'Contact' },
  ],

  about: {
    paragraphs: [
      'I am a Full Stack & AI/ML engineer with four years of production experience, plus a year-long internship, across HDFC Bank, PayU (Wibmo), and FICO. I ship generative AI that survives contact with real users: LLM agents, RAG pipelines, and document intelligence running inside one of the world\’s largest banks, alongside classical ML and computer vision (face and voice biometrics, anti-spoofing, signature verification), all on full-stack architectures I build end to end.',
      'The work holds up under scrutiny. HDFC Bank awarded me the Silver Star for presenting transformative AI directly to the CEO and Board; PayU gave me the Quarterly Ace for zero-defect delivery. I care about the unglamorous parts that make AI production-grade: evaluation harnesses, feedback loops, test coverage, and systems that degrade gracefully instead of hallucinating confidently.',
      'Away from the terminal I am slowly becoming a polyglot: JLPT N4 in Japanese and climbing. I keep my hands busy with guitar and ukulele, painting and digital art, and the occasional tarot spread for friends who want their futures debugged.',
    ],
    hobbies: [
      {
        title: 'Japanese',
        arcana: 'The Polyglot',
        numeral: 'I',
        description:
          'JLPT N4 and steadily climbing. Started with anime subtitles, stayed for the grammar: a language where context does the heavy lifting and every kanji is a tiny compressed story.',
      },
      {
        title: 'Guitar & Ukulele',
        arcana: 'The Strings',
        numeral: 'II',
        description:
          'Six strings or four, the debugging loop is the same: isolate the broken bar, slow it down, repeat until muscle memory ships the fix. Campfire-tested, neighbour-approved (mostly).',
      },
      {
        title: 'Painting & Digital Art',
        arcana: 'The Brush',
        numeral: 'III',
        description:
          'Acrylics when I want texture, a tablet when I want undo. The same instinct that tunes a shader palette decides what goes on the canvas. Color is just another system to reason about.',
      },
      {
        title: 'Tarot',
        arcana: 'The Seer',
        numeral: 'IV',
        description:
          'I read cards for friends: part storytelling, part cold reading, all theatre. The only inference system I run with zero accuracy guarantees and a 100% satisfaction rate.',
      },
    ],
  },

  experience: [
    {
      company: 'HDFC Bank',
      role: 'Data Scientist (Deputy Manager)',
      period: 'Nov 2024 - Present',
      location: 'Bengaluru, India',
      summary:
        'Leading GenAI and biometrics initiatives across the bank, from the first production Python AI platform to face, voice, and signature verification systems, shipping to hundreds of daily internal users and presenting the portfolio to the CEO and Board.',
      highlights: [
        'Built the bank’s first production Python AI platform, serving 800+ users pan-India.',
        'Silver Star Award for AI technical excellence, presented to the CEO & Board.',
        'Led teams of up to 10 engineers across platform, QA, and AI strategy workstreams.',
      ],
      projects: [
        {
          name: 'AI Fabric: TradeOps',
          tag: 'LLM Document Intelligence',
          stack: [
            'Python',
            'FastAPI',
            'Gemini 2.5 Flash',
            'Vertex AI',
            'LiteLLM',
            'LayoutLM',
            'BERT',
          ],
          points: [
            'The bank’s first production Python AI platform: document classification and extraction for 800+ users pan-India at 97% accuracy, cutting manual processing by 90%.',
            'Designed a pluggable LLM interface that eliminates vendor lock-in, plus a centralized prompt hub and an 11-API feedback loop.',
            'Held the line at 98%+ test coverage while leading a team of 4 engineers.',
          ],
        },
        {
          name: 'Cheque Processing: Clearing House',
          tag: 'High-Throughput Document AI',
          stack: ['Gemini 1.5/2.5', 'LayoutLM', 'Donut', 'OpenCV'],
          points: [
            'Solely owned: 99%+ extraction accuracy at 10+ cheques per second.',
            'Built a validation harness over 700K+ ICR reject records.',
            'Projected to halve operations time for cheque clearing.',
          ],
        },
        {
          name: 'VerifyX',
          tag: 'RAG Verification Framework',
          stack: ['ReactJS', 'FastAPI', 'Gemini', 'CAG agent'],
          points: [
            'Audit framework spanning VKYC and ECCS with a chat agent answering over 27,000+ documents.',
            'Demoed live to the CEO & Board.',
          ],
        },
        {
          name: 'Narad AI & VERA',
          tag: 'Agentic Frontends',
          stack: ['ReactJS MFE', 'ThreeJS'],
          points: [
            'Email-agent frontend shipped at 98%+ test coverage.',
            'Voice-to-voice interface with real-time 3D visualizations.',
          ],
        },
        {
          name: 'AI Banking Platform',
          tag: 'LangGraph Orchestration',
          stack: ['LangGraph', 'ReactJS MFE', 'FastAPI'],
          points: [
            'Skills-oriented agentic platform with session management and MFA.',
            'Aqua AI chat micro-frontend embedded across banking surfaces.',
          ],
        },
        {
          name: 'RAG-as-a-Service',
          tag: 'Retrieval Platform',
          stack: ['FAISS', 'BM25', 'Cohere reranker', 'BGE reranker'],
          points: [
            'Hybrid FAISS + BM25 retrieval with Cohere/BGE reranking.',
            'Cut hallucinations 40–60% across 5 downstream projects.',
          ],
        },
        {
          name: 'Pay-by-Face & LOOK',
          tag: 'Biometrics',
          stack: ['ArcFace', 'FaceNet', 'InsightFace', 'CNN anti-spoofing'],
          points: [
            'Benchmarked 7 face-embedding models; shipped sub-100ms recognition at 99.2% accuracy under production load.',
            'Anti-spoofing CNN with FAR below 0.1%.',
            'Earned the Silver Star Award.',
          ],
        },
        {
          name: 'Vaani & Pay-by-Voice',
          tag: 'Voice AI',
          stack: ['Indic Parler-TTS', 'Wav2Vec2', 'Whisper', 'ECAPA-TDNN'],
          points: [
            'Indic text-to-speech plus Wav2Vec2/Whisper speech recognition.',
            'ECAPA-TDNN speaker verification at 97% accuracy.',
          ],
        },
        {
          name: 'Signature Verification',
          tag: 'Document Forensics',
          stack: ['YOLOv8', 'Pix2Pix GAN', 'Embedding matching'],
          points: [
            'YOLOv8 signature detection, Pix2Pix GAN cleanup, and embedding-based matching in one pipeline.',
          ],
        },
        {
          name: 'Ankan',
          tag: 'Annotation Platform',
          stack: ['Active learning', 'Python', 'ReactJS'],
          points: [
            'Active-learning labelling tool used by 100+ users across 10,000+ images.',
            'Adopted as the bank-wide annotation standard.',
          ],
        },
        {
          name: 'Pareekshana & AI OS',
          tag: 'QA & Strategy',
          stack: ['Python', 'CI/CD'],
          points: [
            'Redesigned the QA suite end to end; led up to 10 engineers.',
            'Contributed to board-level AI strategy.',
          ],
        },
      ],
    },
    {
      company: 'PayU (Wibmo)',
      role: 'Software Engineer / Associate Software Engineer',
      period: 'Aug 2022 - Nov 2024',
      location: 'Bengaluru, India',
      summary:
        'Owned the Angular frontend of the Fraud Detection Risk Management Portal end to end, and hardened the backend that kept it standing through traffic spikes.',
      highlights: [
        'Built Spring Boot microservices that absorbed traffic spikes and cut response times by 50%, with 20+ REST APIs on Couchbase and Redis.',
        'Implemented FIDO2/Keycloak authentication and secure gateways.',
        'Ran the stack on Docker, Kubernetes, and Nginx.',
        'Recognized with the ThankU and Quarterly Ace awards for zero-defect delivery.',
      ],
    },
    {
      company: 'FICO',
      role: 'Associate Software Engineer / Intern',
      period: 'Jun 2021 - Aug 2022',
      location: 'Bengaluru, India',
      summary:
        'Computer vision for identity and documents, the year that turned an internship into a career in production ML.',
      highlights: [
        'Built Python + CV pipelines extracting data from bank statements and identity documents.',
        'Optimized C++/Python facial recognition toward FRVT NIST certification.',
        'Annotated rPPG liveness datasets for anti-spoofing research.',
      ],
    },
  ],

  projects: [
    {
      name: 'soweak',
      kind: 'open-source',
      featured: true,
      tagline: 'AI security framework for every boundary of an LLM pipeline.',
      description:
        'OWASP-aligned middleware in Python (PyPI) and TypeScript (npm) that defends input, retrieval, tool calls, output, and streaming with block/redact/transform/approval decisions and full audit trails.',
      stack: [
        'Python',
        'TypeScript',
        'RoBERTa',
        'DeBERTa',
        'LangChain',
        'OpenAI',
        'Gemini',
      ],
      points: [
        'Custom RoBERTa/DeBERTa classifiers for prompt injection, jailbreaks, PII/DLP, and toxicity.',
        'Block, redact, transform, or route-to-approval at every pipeline boundary, with audit trails throughout.',
        'LangChain/OpenAI/Gemini adapters plus a red-team CLI for adversarial testing.',
      ],
      links: [{ label: 'GitHub', url: 'https://github.com/so-weak/soweak' }],
      metrics: [
        { label: 'registries', value: 'PyPI + npm' },
        { label: 'alignment', value: 'OWASP LLM Top 10' },
      ],
    },
    {
      name: 'aakaar',
      kind: 'open-source',
      featured: true,
      tagline: 'Natural language in, typed DAG of real work out.',
      description:
        'An LLM planner that compiles plain language into a typed DAG of registry-defined capabilities, executed on a runtime interpreter with a credential vault and per-task audit, plus a remote-execution spine over WebSockets to cross-OS agents.',
      stack: ['Python', 'LLM planning', 'WebSockets', 'DAG runtime'],
      points: [
        'Plans are typed DAGs over a capability registry; no free-form code execution.',
        'Runtime interpreter with credential vault and per-task audit trail.',
        'Remote-execution spine over WebSockets drives agents across operating systems.',
      ],
      links: [{ label: 'GitHub', url: 'https://github.com/so-weak/aakaar' }],
    },
    {
      name: 'AI Fabric: TradeOps',
      kind: 'platform',
      featured: true,
      tagline: 'The bank’s first production Python AI platform.',
      description:
        'LLM document intelligence (classification and extraction) for trade operations, serving 800+ users pan-India with a pluggable LLM interface, prompt hub, and an 11-API feedback loop.',
      stack: [
        'Python',
        'FastAPI',
        'Gemini 2.5 Flash',
        'Vertex AI',
        'LiteLLM',
        'LayoutLM',
        'BERT',
      ],
      points: [
        '97% extraction accuracy; manual processing cut by 90%.',
        'Pluggable LLM interface eliminates vendor lock-in.',
        '98%+ test coverage; led a team of 4 engineers.',
      ],
      metrics: [
        { label: 'daily users', value: '800+' },
        { label: 'accuracy', value: '97%' },
        { label: 'manual work cut', value: '90%' },
      ],
    },
    {
      name: 'Pay-by-Face & LOOK',
      kind: 'platform',
      featured: true,
      tagline: 'Sub-100ms face recognition that holds up in production.',
      description:
        'Benchmarked 7 face-embedding models and shipped a recognition stack running at 99.2% accuracy under production load, backed by an anti-spoofing CNN with FAR below 0.1%. Earned the Silver Star Award.',
      stack: ['ArcFace', 'FaceNet', 'InsightFace', 'CNN', 'OpenCV'],
      points: [
        '7 embedding models benchmarked head-to-head before shipping.',
        '99.2% accuracy at sub-100ms latency under production load.',
        'Anti-spoofing CNN with false-accept rate below 0.1%.',
      ],
      metrics: [
        { label: 'accuracy', value: '99.2%' },
        { label: 'latency', value: '<100ms' },
        { label: 'FAR', value: '<0.1%' },
      ],
    },
    {
      name: 'RAG-as-a-Service',
      kind: 'platform',
      featured: true,
      tagline: 'Retrieval that refuses to make things up.',
      description:
        'Hybrid FAISS + BM25 retrieval with Cohere/BGE reranking, packaged as a service and consumed by 5 projects across the bank, cutting hallucinations by 40-60%.',
      stack: ['FAISS', 'BM25', 'Cohere reranker', 'BGE reranker', 'FastAPI'],
      points: [
        'Hybrid dense + sparse retrieval with a reranking stage.',
        '40–60% hallucination reduction measured across 5 consuming projects.',
      ],
      metrics: [
        { label: 'hallucination cut', value: '40–60%' },
        { label: 'consuming projects', value: '5' },
      ],
    },
    {
      name: 'VerifyX',
      kind: 'platform',
      featured: true,
      tagline: 'An audit framework the Board talks to.',
      description:
        'RAG verification framework spanning VKYC and ECCS, with a chat agent answering questions over 27,000+ documents, demoed live to the CEO & Board.',
      stack: ['ReactJS', 'FastAPI', 'Gemini', 'CAG agent'],
      points: [
        'Chat agent grounded in 27,000+ audit documents.',
        'Covers VKYC and ECCS audit workflows.',
        'Demoed live to the CEO & Board.',
      ],
      metrics: [{ label: 'documents', value: '27,000+' }],
    },
    {
      name: 'Cheque Document AI',
      kind: 'platform',
      featured: false,
      tagline: 'Clearing-house throughput, single-owner reliability.',
      description:
        'High-throughput cheque processing at 99%+ accuracy and 10+ cheques per second, validated against 700K+ ICR reject records, projected to halve operations time.',
      stack: ['Gemini 1.5/2.5', 'LayoutLM', 'Donut', 'OpenCV'],
      points: [
        '99%+ accuracy at 10+ cheques/second.',
        'Validation harness built over 700K+ ICR reject records.',
      ],
      metrics: [
        { label: 'throughput', value: '10+/sec' },
        { label: 'accuracy', value: '99%+' },
      ],
    },
    {
      name: 'Narad AI & VERA',
      kind: 'platform',
      featured: false,
      tagline: 'Agentic frontends you can talk to, literally.',
      description:
        'An email-agent micro-frontend shipped at 98%+ test coverage, and a voice-to-voice interface with real-time 3D visualizations.',
      stack: ['ReactJS MFE', 'ThreeJS'],
      points: [
        'Email-agent frontend at 98%+ test coverage.',
        'Voice-to-voice interaction visualized in real-time 3D.',
      ],
    },
    {
      name: 'Vaani & Pay-by-Voice',
      kind: 'platform',
      featured: false,
      tagline: 'Indic voice AI, end to end.',
      description:
        'Indic Parler-TTS speech synthesis with Wav2Vec2/Whisper recognition and ECAPA-TDNN speaker verification at 97% accuracy.',
      stack: ['Indic Parler-TTS', 'Wav2Vec2', 'Whisper', 'ECAPA-TDNN'],
      points: [
        'Text-to-speech tuned for Indic languages.',
        'Speaker verification at 97% accuracy.',
      ],
      metrics: [{ label: 'speaker verification', value: '97%' }],
    },
    {
      name: 'Ankan',
      kind: 'platform',
      featured: false,
      tagline: 'The labelling tool that became the bank-wide standard.',
      description:
        'Active-learning annotation platform used by 100+ users across 10,000+ images, now the bank-wide standard for labelling.',
      stack: ['Python', 'ReactJS', 'Active learning'],
      points: [
        'Active learning keeps humans labelling only what the model needs.',
        '100+ users, 10,000+ images, bank-wide adoption.',
      ],
      metrics: [
        { label: 'users', value: '100+' },
        { label: 'images', value: '10,000+' },
      ],
    },
  ],

  skills: [
    {
      group: 'Languages',
      items: ['Python', 'Java', 'TypeScript', 'JavaScript', 'C/C++'],
    },
    {
      group: 'GenAI / LLM',
      items: [
        'Gemini',
        'Vertex AI',
        'LiteLLM',
        'LangChain',
        'LangGraph',
        'RAG',
        'Agentic Frameworks',
        'Prompt Engineering',
      ],
    },
    {
      group: 'ML / CV / NLP',
      items: [
        'PyTorch',
        'Transformers',
        'BERT',
        'RoBERTa',
        'DeBERTa',
        'LayoutLM',
        'Donut',
        'YOLOv8',
        'Pix2Pix GAN',
        'ArcFace',
        'FaceNet',
        'InsightFace',
        'Wav2Vec2',
        'Whisper',
        'Indic Parler-TTS',
        'ECAPA-TDNN',
      ],
    },
    {
      group: 'Full Stack',
      items: [
        'ReactJS',
        'Angular',
        'Micro Frontends',
        'ThreeJS',
        'FastAPI',
        'Spring Boot',
        'Node.js',
        'REST',
        'Microservices',
      ],
    },
    {
      group: 'Data / Infra',
      items: [
        'PostgreSQL',
        'MySQL',
        'Couchbase',
        'Redis',
        'FAISS',
        'BM25',
        'YugabyteDB',
        'Docker',
        'Kubernetes',
        'CI/CD',
        'GCP',
        'AWS',
        'Kafka',
        'Keycloak',
        'FIDO2',
        'OAuth',
        'OWASP LLM Top 10',
      ],
    },
  ],

  awards: [
    'Silver Star Award: HDFC Bank, AI technical excellence, presented to CEO & Board',
    'Quarterly Ace Award: PayU, zero-defect delivery',
    'ThankU Award: PayU',
    'Delegate: Google I/O Connect Bengaluru 2025',
  ],

  certifications: [
    'Google IT Support Specialization',
    'From Data to Insights with Google Cloud',
    'Human-Centered Design',
    'JLPT N4 (Japanese Language Proficiency)',
  ],

  education: [
    {
      school: 'KIIT, Bhubaneswar',
      degree: 'B.Tech, Computer Science & Engineering',
      detail: '9.56 CGPA',
      period: '2018 - 2022',
    },
    {
      school: 'Delhi Public School, Dhanbad',
      degree: 'Class XII (CBSE)',
      detail: '90.4%',
      period: '2018',
    },
    {
      school: 'De-Nobili School CMRI, Dhanbad',
      degree: 'Class X (ICSE)',
      detail: '95%',
      period: '2016',
    },
  ],

  writing: [
    {
      title: 'Designing RAG that refuses to hallucinate',
      blurb:
        'Hybrid retrieval, reranking, and the evaluation harnesses that took hallucinations down 40–60% across five production systems.',
      status: 'published',
      url: '/article.html',
      minutes: 8,
    },
    {
      title: 'Shipping LLMs inside a bank: what production really means',
      blurb:
        'Vendor-agnostic LLM interfaces, feedback loops, 98% test coverage: the unglamorous machinery behind 800 daily users.',
      status: 'coming-soon',
    },
    {
      title: 'Anti-spoofing in the wild: faces, voices, and forgeries',
      blurb:
        'What it takes to keep biometric systems honest: CNN anti-spoofing, speaker verification, and GAN-assisted signature forensics.',
      status: 'coming-soon',
    },
  ],

  contact: {
    heading: 'Let us build something intelligent.',
    blurb:
      'I am always up for a conversation about production AI, security for LLM systems, or a collaboration that ships. Email me, find me on GitHub or LinkedIn, or grab the résumé. I answer faster than my RAG pipelines.',
  },
}
