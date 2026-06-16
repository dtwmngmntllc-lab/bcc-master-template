-- ============================================================
-- BCC SEED: STATE FARM COMPLIANCE RULES LIBRARY v2.0
-- Business Command Center — State Farm Agent Edition
-- Built by Imaginary Farms LLC · imaginary-farms.com
-- ============================================================
-- SOURCES:
--   AA05 Agent Agreement (Form AA05.2, effective July 1, 2020)
--   Social Chef Claude Compliance Knowledge Base v2.1
--   Social Chef Claude Content Playbook v1.0
--   State Farm Agency Reference Guide v1.0 (Jan 2026)
--   State Farm Business Accounts Guidelines (updated Sep 2025)
--   State Farm Giveaway Guidelines (updated Jul 2025)
--   State Farm Vendor & Paid Advertising Compliance (Aug 2025)
--   Compliance Review Checklist (Imaginary Farms)
--
-- 57 rules across 10 categories with AA05 contract citations.
-- Every rule Claude uses as a guardrail in conversation.
-- Full 26-item social media pre-post checklist included.
--
-- Replace 'AGENCY_ID_PLACEHOLDER' before running.
-- ============================================================

-- ============================================================
-- CATEGORY 1: AGENT RELATIONSHIP & CONTRACT FUNDAMENTALS
-- ============================================================

INSERT INTO compliance_rules (agency_id, rule_code, category, title, description, requirement, source, severity, is_active) VALUES

('AGENCY_ID_PLACEHOLDER'::UUID, 'AA05-001', 'contract', 'Independent Contractor Status',
'State Farm agents are INDEPENDENT CONTRACTORS, not employees. Agents have full control of daily activities, work hours, and methods. State Farm does not control the manner of work performance.',
'Never represent yourself as a State Farm employee. Always identify yourself as an independent contractor agent.',
'AA05 Section I.C — Independent Contractor Status', 'info', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'AA05-002', 'contract', 'Principal-Agent Relationship — Customer Not Client',
'The agent-customer relationship is Principal-Agent, NOT fiduciary. The word "client" implies a fiduciary duty the agent does not hold. Using "client" misrepresents the legal relationship and creates liability exposure. Always use "customer" in all contexts without exception.',
'Never use the word "client" in any context — social media, advertising, conversation, or written communications. Always use "customer." This is contractually required.',
'AA05 Section I.B — Principal-Agent Relationship', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'AA05-003', 'contract', 'Agent Title Restriction — No Expert, Specialist, or Advisor',
'AA05 Section I.O prohibits representing yourself in any capacity other than as an individual agent. Words like "expert," "specialist," "advisor," "consultant," and "educator" (in agent-customer context) create a legally heightened expectation of service. If a customer does not receive that service level, these words become legal ammunition in court. Never use any of these titles.',
'Only represent yourself as an "agent" or "licensed agent." Remove expert, specialist, advisor, consultant, educator, or any title implying elevated credentials.',
'AA05 Section I.O — Agent Representation Limitation', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'AA05-004', 'contract', 'Exclusivity — State Farm as Principal Occupation',
'State Farm must be the agent''s principal occupation. Agents cannot write for other insurance companies or act as agent or broker for others without written State Farm consent.',
'Do not sell insurance for any other carrier without written SF consent. Verify any outside business activity does not conflict with exclusivity requirement.',
'AA05 Section I.I — Exclusivity Requirement', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'AA05-005', 'contract', 'Annual Compliance and Ethics Training — Mandatory',
'Annual compliance and ethics training is contractually required for all agents under the AA05 agreement. This is a binding obligation, not optional guidance. Must be completed every calendar year.',
'Complete State Farm annual compliance and ethics training every year. Maintain completion documentation. Ensure all licensed staff also complete required training.',
'AA05 Section I.D — Compliance with Laws and Procedures', 'critical', TRUE);

-- ============================================================
-- CATEGORY 2: ADVERTISING & MARKETING COMPLIANCE
-- ============================================================

INSERT INTO compliance_rules (agency_id, rule_code, category, title, description, requirement, source, severity, is_active) VALUES

('AGENCY_ID_PLACEHOLDER'::UUID, 'AD-001', 'advertising', 'Prior Approval Required for All SF-Referencing Advertising',
'ALL advertisements referring to or identifying State Farm Companies — directly or indirectly — require PRIOR WRITTEN APPROVAL before use. This is a binding contractual requirement. Includes: print, digital, social media, business cards with SF branding, signage, promotional materials, email marketing, and website content mentioning State Farm. Preapproved content from Hootsuite, Neighborhood Marketing Platform, and Digital Content Program satisfies this requirement and may not be modified.',
'Submit all non-template advertising for SF approval before publishing. Use only preapproved content without modification. Document approval for all original advertising.',
'AA05 Section I.H — Advertising Approval Requirement', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'AD-002', 'advertising', 'Prohibited Absolute, Guarantee, and Superlative Language',
'State Farm controls all pricing (AA05 I.N). Agents have NO authority over premiums, fees, or charges. Therefore pricing language and service guarantees are inherently misleading. PROHIBITED: absolutes (always, never), guarantees (will, promise, proper, ideal), superlatives (best, better, great, #1), pricing language (low cost, cheap, inexpensive, affordable, customized, tailor), service claims (most reliable, peace of mind, fully covered, first-class, world-class coverage). EXCEPTION: "best" is acceptable ONLY when naming a specific award.',
'Review all content for prohibited absolute, guarantee, and superlative language. Use "may," "could," and "designed to" language when discussing services.',
'AA05 Section I.D (false advertising) + AA05 Section I.N (SF controls pricing)', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'AD-003', 'advertising', 'Complete Prohibited Terms and Word Substitution List',
'Claude must apply this substitution list to all content and flag any prohibited term:
NEVER USE → USE INSTEAD (with contract basis):
• Client → Customer (AA05 I.B: Principal-Agent relationship)
• Solutions → Options (SF provides options, not solutions)
• Sales/Sell → Rephrase (agent does not own products)
• Trust (for agent) → Reserve for SF entity only
• Educate/Educator → Rephrase in agent-customer context
• Expert/Specialist → Remove entirely (AA05 I.O + legal liability)
• Fully licensed → Licensed (remove "fully")
• Get a PPP → Create a Personal Price Plan®
• Affordable rates → Rates more affordable than you think
• Best/#1 → Remove unless naming a specific award
• Low cost/Cheap → Remove (AA05 I.N: SF controls pricing)
• World-class → Remove entirely
• Transfers welcome → Remove (AA05 I.J: anti-raiding clause)
• Financial freedom → Remove (prohibited)
• Wealth accumulation → Remove (prohibited)',
'Apply the word substitution list to all content. Flag any prohibited term immediately and suggest compliant alternative.',
'AA05 Sections I.B, I.D, I.J, I.N, I.O — Multiple clauses', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'AD-004', 'advertising', 'Internet Banner Ad Requirements',
'Approved internet banner ads are available on the Neighborhood Marketing Platform. Banner ads must link to the SF agent microsite, agent domain with M1/M2 or microsite content, or Agent Quote Landing Page. Agents must contact their market area prior to purchasing space on third-party websites not already approved.',
'Use only NMP-approved banner ads. Contact market area for approval before placing ads on unapproved third-party sites.',
'State Farm Vendor and Paid Advertising Compliance (Aug 2025)', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'AD-005', 'advertising', 'Approved vs. Non-Approved Third-Party Advertising Sites',
'APPROVED third-party advertising sites include: search engines and map/navigation sites, internet directories, Chamber of Commerce, local professionals (realtors, dentists, doctors), local news sites, local retail/restaurants/businesses (EXCEPT auto repair, body shops, glass companies), community sports organizations, nonprofits, government agencies, schools, professional associations, and social networking sites (Facebook, Instagram, X, LinkedIn). Agents cannot refer to themselves as "affiliate, partner, or associate" of other organizations — only as "local businesses in the area."',
'Verify advertising site is on approved list before placing. Contact market area for any unapproved site.',
'State Farm Vendor and Paid Advertising Compliance (Aug 2025)', 'warning', TRUE);

-- ============================================================
-- CATEGORY 3: SOCIAL MEDIA COMPLIANCE
-- ============================================================

INSERT INTO compliance_rules (agency_id, rule_code, category, title, description, requirement, source, severity, is_active) VALUES

('AGENCY_ID_PLACEHOLDER'::UUID, 'SM-001', 'social_media', 'Social Media Philosophy — Bridge Not Sales Floor',
'Social media is a BRIDGE to a relationship, not a digital sales floor. Content pillars: INFORM (share timely news), EDUCATE (share tips), ENTERTAIN (personal, community, fun). The 80/20 Rule: 80% value-first content, 20% business-adjacent content. Never hard-sell on social media. Take sales conversations offline. Social media algorithms prioritize engagement — focus on quality over quantity.',
'Apply the 80/20 rule to all social content. Never use social media as a direct sales platform. Soft CTAs only — availability and invitation, never persuasion.',
'Social Chef Claude Compliance KB v2.1 — Section 1', 'info', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'SM-002', 'social_media', 'Approved Social Media Platforms',
'Approved platforms: Facebook (relationship building), X/Twitter (public conversation), LinkedIn (professional networking), Instagram (photos, videos, reels). Each platform must be monitored DAILY. Designate a compliance lead to monitor all accounts daily and respond to comments and reviews consistently.',
'Only use approved platforms for business accounts. Monitor all accounts daily. Never create business accounts on unapproved platforms.',
'Social Chef Claude Compliance KB v2.1 — Section 3', 'info', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'SM-003', 'social_media', 'Instagram Manual Posting Requirement — CRITICAL',
'Instagram posts MUST be posted manually each day. There is no reliable advance scheduling for Instagram via API. The BCC automation system will flag Instagram posts as requiring manual posting and create a daily reminder alert — it will NOT auto-post to Instagram. Content can be batch-prepared in advance but requires daily manual posting.',
'Prepare Instagram content in advance using content batching. Post manually each day at scheduled time. Set phone reminders. Never assume Instagram content will auto-post.',
'Social Chef Claude Content Playbook v1.0 — Section 3B', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'SM-004', 'social_media', 'Direct Messaging Rules',
'Direct messaging is ONLY authorized on Facebook and Instagram. When responding to DMs, a specific privacy disclaimer must be included. Never initiate unsolicited DMs about products or services. Be careful when using third-party tools to manage messaging — some tools are not authorized.',
'Only use DMs on Facebook and Instagram. Include required privacy disclaimer in all DM responses. Never cold-DM customers about products.',
'Social Chef Claude Compliance KB v2.1 — Section 3', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'SM-005', 'social_media', 'English-Only Content Requirement',
'ALL business account content must be written in English unless it is preapproved content. FINRA requires ALL communications to be archived and monitored. Proofpoint compliance monitoring software is English-only. FINRA considers providing securities information in non-English without a prospectus to be misleading. No tildes, special characters, or in-language text. Exception: preapproved Spanish paid search ads and listing spoken languages ("fluent in French") with all surrounding text in English.',
'Write all original social content in English only. This is a contractual compliance requirement under FINRA archiving rules, not just a preference.',
'AA05 Section I.D + FINRA Rule 2210 + Social Chef Claude Compliance KB v2.1 — Section 12', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'SM-006', 'social_media', 'Staff Social Media Accountability — Agent Liable for All Staff Posts',
'AA05 Section I.P makes the agent "responsible for your staffs'' activities." Agents are contractually liable for EVERY social media post their staff creates, shares, or publishes on behalf of the agency. All staff must be trained on compliance rules before getting account access. Staff cannot freelance content without agent review. The agent — not the staff member — bears contractual responsibility for violations.',
'Train all staff on compliance rules before granting social media account access. Review staff content before publishing. Document training completion.',
'AA05 Section I.P — Agent Responsible for Staff Activities', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'SM-007', 'social_media', 'AI-Generated Content Disclaimer Required',
'Any AI-produced or AI-enhanced images or videos REQUIRE disclaimers per platform Terms and Conditions. Examples of compliant disclaimers: "Created with the help of AI" or "AI-generated." This is required by platform rules, not optional.',
'Include AI disclaimer on all AI-generated or AI-enhanced visual content before posting to any platform.',
'Platform Terms and Conditions — All Major Platforms', 'warning', TRUE);

-- ============================================================
-- CATEGORY 4: ABSOLUTELY PROHIBITED SOCIAL MEDIA CONTENT
-- ============================================================

INSERT INTO compliance_rules (agency_id, rule_code, category, title, description, requirement, source, severity, is_active) VALUES

('AGENCY_ID_PLACEHOLDER'::UUID, 'SM-PROHIBIT-001', 'social_media', 'Absolutely Prohibited Social Media Topics',
'These topics may NEVER appear on any agent social media account:
• Investment Planning Services and Mutual Funds
• State Farm College Savings Plans (529 plans)
• Any Investment Planning Services Triggers (SFVPMC RR Manual)
• Specific life or health insurance products BY NAME
• Pricing models, specific rates, or premium amounts
• Internal State Farm processes or procedures
• Incentive programs (ScoreCard details, bonus structures, travel awards)
• Proprietary State Farm information
• Claims and underwriting rules
• Rates and rating processes
• Internal programs, tools, and contracts
• Budgets and allocations
These topics either require regulatory filing, expose proprietary information, or violate AA05 contractual restrictions. If content touches any of these — DO NOT generate it. Flag immediately.',
'Immediately flag and refuse any request to create content touching these prohibited topics. Explain why and suggest compliant alternatives.',
'AA05 Section I.D, I.F, I.H, I.N + Social Chef Claude Compliance KB v2.1 — Section 4', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'SM-PROHIBIT-002', 'social_media', 'Customer Data — Absolute Prohibition',
'Customer information (names, addresses, ages, property descriptions, policy dates, account and investment information) constitutes State Farm''s TRADE SECRETS under AA05 Section I.F. Sharing customer data on social media is misuse of Company trade secrets — a contract violation, not merely a privacy issue. Never confirm or deny that someone is a customer in a public review response, as this may also violate HIPAA if health products are involved.',
'Never post, reference, or confirm any customer information on social media. Move all customer discussions to private channels.',
'AA05 Section I.F — Customer Data as Company Trade Secrets + HIPAA BAA', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'SM-PROHIBIT-003', 'social_media', 'No PHI Visible in Photos or Videos',
'Photos and videos must NEVER contain visible Protected Health Information (PHI). The agent''s signed HIPAA Business Associate Agreement (AMD99) creates responsibility for safeguarding all PHI. Check for visible paperwork, screen displays, computer screens, documents, or forms containing health-related information before posting any office photo or video.',
'Review all photos and video backgrounds for any visible PHI before publishing. When in doubt, do not post.',
'HIPAA Business Associate Amendment (AMD99)', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'SM-PROHIBIT-004', 'social_media', 'Trademark and Copyright Prohibitions',
'Agents may not use copyrighted or trademarked terminology or images without permission. Both agent and State Farm could face fines for copyright infringement. Never mention or reference: major sporting events, teams, athletes or mascots (Super Bowl, March Madness, NCAA, Chicago Bears, etc.), or major brand names (Visa, Starbucks, Disney, Apple, etc.) on business accounts. For giveaways, always use generic descriptions — "coffee shop gift card" not "Starbucks gift card."',
'Avoid all trademark and brand name references in posts. Use generic descriptions for all third-party products and events.',
'Intellectual Property Law + State Farm Business Accounts Guidelines (Sep 2025)', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'SM-PROHIBIT-005', 'social_media', 'No Scare Tactics or Fear-Based Content',
'Agents are prohibited from using scare tactics, fear mongering, or burden language in any content or advertising. Prohibited: words like "devastate," "burden," "GoFundMe," "financial ruin," or content designed to frighten customers. Content pillars must be INFORM, EDUCATE, ENTERTAIN — never intimidate.',
'Replace any fear-based language with educational, empowering alternatives. Education not intimidation.',
'AA05 Section I.D — Unfair Practices', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'SM-PROHIBIT-006', 'social_media', 'Written Release Required for All Identifiable People in Photos/Videos',
'A person''s face is their LEGAL PROPERTY under Right of Publicity laws. Using someone''s likeness without a signed release is a potential legal infringement. Written permission is required from every recognizable person in photos or videos — including team members, customers, local heroes, community members, and event attendees. Even a "simple office photo" carries this legal risk. Obtain written releases BEFORE posting.',
'Obtain written releases from ALL identifiable people before posting any photo or video. Maintain release documentation on file.',
'Right of Publicity Laws + Social Chef Claude Compliance KB v2.1 — Section 7', 'critical', TRUE);

-- ============================================================
-- CATEGORY 5: TRADEMARK AND BRAND STANDARDS
-- ============================================================

INSERT INTO compliance_rules (agency_id, rule_code, category, title, description, requirement, source, severity, is_active) VALUES

('AGENCY_ID_PLACEHOLDER'::UUID, 'TM-001', 'trademark', 'State Farm Name in Social Media Account Names',
'"State Farm" in account names or usernames is authorized ONLY if immediately followed by "agent." CORRECT: "Jane Doe – State Farm Agent." INCORRECT: "Jane Doe State Farm" or "State Farm Jane." Only legally incorporated agents with an Incorporated Agent Agreement can use "Agency" in their account name.',
'Verify all social media account names follow the "Name – State Farm Agent" format exactly.',
'State Farm Brand Standards + Building Our Brand Guidelines', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'TM-002', 'trademark', 'State Farm Slogan Cannot Be Altered',
'"Like a good neighbor, State Farm is there.®" — This slogan must NOT be altered, abbreviated, or paraphrased in any way. Use the complete exact phrase with registered trademark symbol or do not use it at all.',
'Use the State Farm slogan only in its complete, exact form with the registered trademark symbol.',
'State Farm Brand Standards', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'TM-003', 'trademark', 'Personal Price Plan® Correct Usage',
'Must use the full three-word capitalized phrase "Personal Price Plan®" with the registered trademark symbol. Cannot be abbreviated as PPP or "personal price plan." Consumers "CREATE" a Personal Price Plan — never "get" one. Personalization reflects the consumer''s choices, not State Farm''s.',
'Write "Personal Price Plan®" in full with trademark symbol always. Consumers always "create" their PPP.',
'State Farm Brand Standards', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'TM-004', 'trademark', 'Google Business Profile — Financial Services Strictly Forbidden',
'Google Business Profile is approved for insurance products ONLY — NOT financial services. STRICTLY FORBIDDEN on GBP: financial services, banking products, Certificates of Deposit, annuities, mutual funds, securities, specific life or health insurance products, any non-P&C insurance product promotion. State Farm has the right to request removal of any non-compliant content. GBP must be created using the agent''s State Farm Outlook email address (firstname.lastname.alias@statefarm.com). Gmail is non-compliant for GBP.',
'Review all GBP content for insurance-only compliance. Remove any financial services content immediately. Use SF Outlook email for GBP.',
'State Farm Business Accounts Guidelines (Sep 2025)', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'TM-005', 'trademark', 'Multi-Office GBP — Distinct Listing Required per Location',
'Each office location MUST have its own distinct Google Business Profile listing. Never combine or share GBP listings. Never use one phone number across multiple location pages. Shared phone numbers hurt local SEO rankings. Each listing must have its own unique phone number, address, and contact details.',
'Verify each office location has a distinct GBP listing with a unique phone number and address.',
'State Farm Business Accounts Guidelines (Sep 2025) — Multi-Office Rules', 'warning', TRUE);

-- ============================================================
-- CATEGORY 6: GIVEAWAY AND PROMOTIONAL COMPLIANCE
-- ============================================================

INSERT INTO compliance_rules (agency_id, rule_code, category, title, description, requirement, source, severity, is_active) VALUES

('AGENCY_ID_PLACEHOLDER'::UUID, 'GIVE-001', 'giveaways', 'No Element of Chance in Any Giveaway — Required',
'Sweepstakes, contests, lotteries, raffles, drawings, and any "enter to win" format are NOT PERMITTED. An element of chance is considered an illegal lottery. Instead, EVERY person who takes the specified action MUST receive the item — no randomness, no winner selection. COMPLIANT: "Stop by our office for a free umbrella." NON-COMPLIANT: "Stop by and be entered to win an umbrella."',
'Structure all giveaways so every participant who takes the specified action receives the item. No lottery, contest, sweepstakes, drawing, or "enter to win" language ever.',
'State Farm Giveaway Guidelines (Jul 2025)', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'GIVE-002', 'giveaways', 'Giveaway Items — Generic Descriptions Only',
'Giveaway items must be described generically — never using brand or trademark names. COMPLIANT: "coffee shop gift card." NON-COMPLIANT: "Starbucks gift card." IP laws require written permission from a company to mention their product as a giveaway item.',
'Use only generic descriptions for giveaway items. Never mention brand names without written permission.',
'State Farm Giveaway Guidelines (Jul 2025) + Intellectual Property Law', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'GIVE-003', 'giveaways', 'Gift Cards for Quotes — Compliant Structure',
'Agents ARE permitted to offer gift cards in exchange for quotes if properly structured: (1) Gift cards cannot be contingent on a sale — must be given upon quote regardless of purchase. (2) Include "no purchase necessary" language in promotional posts. (3) Gift card amounts must stay within the agent''s state rebating limits. (4) Cannot mention trademarked business names without permission.',
'Include "no purchase necessary" in quote-for-gift-card promotions. Give gift card regardless of purchase. Verify amount is within state rebating limits.',
'State Farm Giveaway Guidelines (Jul 2025)', 'info', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'GIVE-004', 'giveaways', 'Referral Rewards Cannot Be Advertised on Social Media',
'Referral rewards — gift cards, monetary value, actual gifts — may NOT be expressed, advertised, or shared on any social media platform. Agents are also not authorized to mention giveaways tied to Bank or Securities products on social media at any time.',
'Keep all referral reward programs in private direct communications only. Never post referral rewards or bank/securities-linked giveaways on social media.',
'State Farm Giveaway Guidelines (Jul 2025)', 'critical', TRUE);

-- ============================================================
-- CATEGORY 7: FINANCIAL COMPLIANCE
-- ============================================================

INSERT INTO compliance_rules (agency_id, rule_code, category, title, description, requirement, source, severity, is_active) VALUES

('AGENCY_ID_PLACEHOLDER'::UUID, 'FIN-001', 'financial', 'Premium Fund Account — Strict Segregation and Audit Readiness',
'Agents MUST maintain a Premium Fund Account (PFA) at a State Farm-approved bank. This account is held FOR THE BENEFIT OF STATE FARM and is subject to audit at any time. All collected premiums must be deposited promptly. Amounts owing to SF Companies constitute a FIRST LIEN on payments due to the agent. The PFA bank box must be kept secure with access limited to agent and Customer Service Manager only (2 keys maximum). NEVER commingle PFA funds with operating or personal accounts. Maintain 3 months of reconciled PFA bank statements.',
'Maintain separate PFA. Deposit all premiums promptly. Transmit per SF schedule. Keep PFA box secure with 2 keys only. Never commingle funds. Maintain 3 months reconciled statements.',
'AA05 Section I.K — Premium Trust Account + Compliance Review Checklist', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'FIN-002', 'financial', 'PFA — Not a Business Asset, Not on Balance Sheet',
'The Policy Financing Arrangement (PFA) is a STATE FARM COMPLIANCE ITEM ONLY. It is NOT a business asset and does NOT appear on the agency balance sheet. Agents may not represent PFA balance as personal or business equity, use PFA as collateral, or treat it as an investment asset. Review PFA activity with CPA annually for proper tax treatment. The BCC Financials module treats PFA as compliance tracking only — never as an asset.',
'Exclude PFA balance from all business financial statements. Never use PFA as collateral. Review with CPA annually.',
'SF PFA Policy Guidelines + Imaginary Farms Standard Accounting Rules', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'FIN-003', 'financial', 'No Rebating or Unauthorized Incentives',
'Agents are absolutely prohibited from offering, promising, or providing any rebate, discount, abatement, or special favor not specified in the insurance contract as an inducement to purchase insurance. Includes gift cards, free services, or other items of value tied to policy purchases (as opposed to quotes). Paying for or incentivizing Google reviews is also prohibited.',
'Never offer anything of value contingent on a policy purchase. Gift cards for quotes are permitted but never for sales. Never pay for or incentivize Google reviews.',
'AA05 Section I.D — Unfair Practices + Anti-Rebating Laws', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'FIN-004', 'financial', 'Chargeback Awareness — Commission Recovery Provisions',
'Various SF products include chargeback provisions where commissions may be recovered if policies cancel early or do not meet requirements. Common chargeback triggers: early cancellations, policy lapses, missing information, non-compliance, and death within specified periods.',
'Monitor policies for early cancellation risk. Understand chargeback provisions for each product line.',
'AA05 Section II — Compensation and Chargeback Provisions', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'FIN-005', 'financial', 'Agency Financial Health Benchmarks',
'State Farm Agency Reference Guide financial health benchmarks — Claude uses these when analyzing P&L:
TOTAL PAYROLL + TAXES / GROSS INCOME: Healthy 40-50% | Warning 51-55% | Critical >55%
TEAM PAYROLL ONLY / GROSS INCOME: Healthy 30-38% | Warning 39-45% | Critical >45%
OWNER COMPENSATION / GROSS INCOME: Healthy 25-35% | Warning 20-24% | Critical <20%
RENT / GROSS INCOME: Healthy 5-8% | Warning 9-12% | Critical >12%
TOTAL OPERATING EXPENSES / GROSS INCOME: Healthy 15-22% | Warning 23-28% | Critical >28%
NET PROFIT MARGIN: Healthy 25-35% | Warning 20-24% | Critical <20%',
'Monitor all financial ratios monthly against these benchmarks. Flag any ratio in warning or critical territory with recommended action.',
'State Farm Agency Reference Guide v1.0 (Jan 2026) — Financial Benchmarks', 'info', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'FIN-006', 'financial', 'Draft Check Sequential Order Required',
'Draft checks — both Life and Premium Fund — must be maintained in sequential order at all times. Compliance audits specifically check for out-of-sequence checks as a red flag for unauthorized or altered transactions.',
'Maintain all draft check sequences in strict sequential order. Verify during monthly compliance review.',
'SF Compliance Review Checklist — Imaginary Farms', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'FIN-007', 'financial', 'Altered Monies History — Monthly Tracking Required',
'History of Altered Monies must be tracked monthly. This is a standing compliance calendar item. Compliance reviews specifically check for altered money activity.',
'Track and review Altered Monies history monthly. Maintain calendar reminder. Document review completion.',
'SF Compliance Review Checklist — Imaginary Farms', 'warning', TRUE);

-- ============================================================
-- CATEGORY 8: LICENSING AND STAFF REQUIREMENTS
-- ============================================================

INSERT INTO compliance_rules (agency_id, rule_code, category, title, description, requirement, source, severity, is_active) VALUES

('AGENCY_ID_PLACEHOLDER'::UUID, 'LIC-001', 'licensing', 'License Verification Before Any Business Activity',
'CRITICAL: Verify licensing before ANY product sale or binding activity. Required licenses may include: Property and Casualty, Life Insurance, Health Insurance, Variable Products (Series 6/63), Bank Products, and state-specific certifications. Staff must be licensed and authorized BEFORE any business activities. Never permit unlicensed staff to perform licensed activities.',
'Before any sale: (1) Verify agent holds required license, (2) Confirm license is current, (3) Verify involved staff are credentialed for that specific product. Document verification.',
'AA05 Section I.D + Section I.P — Licensing Requirements', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'LIC-002', 'licensing', 'Continuing Education — Track and Complete by Deadline',
'Must complete state-mandated CE hours in each licensed state during each CE cycle. Requirements vary by state. Failure results in license non-renewal. Maintain CE completion certificates for minimum 4 years. Track CE hours remaining for all licensed states and all licensed staff members.',
'Track CE deadlines and hours for all licensed states and licensed staff. Complete required hours before deadline. Store certificates 4+ years.',
'State Insurance Department CE Requirements (varies by state)', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'LIC-003', 'licensing', 'E&O Insurance — Never Let It Lapse',
'Agents must maintain current E&O insurance coverage at all times. Lapsed E&O is a contract violation. Flag E&O renewal 90 days before expiration. Provide updated certificate to SF immediately upon renewal.',
'Track E&O expiration. Begin renewal 90 days before expiration. Never let E&O lapse. Send renewal certificate to SF immediately.',
'SF Agent Agreement — E&O Requirements', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'LIC-004', 'licensing', 'New Team Member — SF Notification and Authorization Required',
'Notify State Farm of all new team member hires within the required timeframe. Complete required background checks before start date. Staff must receive authorization before binding any risk. Never permit new hires to perform licensed activities before receiving proper authorization.',
'Notify SF of new hires within required timeframe. Complete background checks before start. Verify all authorizations before licensed activities.',
'AA05 Section I.P + SF Agent Team Member Guidelines', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'LIC-005', 'licensing', 'Monthly Auto Application Compliance Review',
'Required monthly compliance review process:
• Pull RAZ000BT report
• Review apps where prior BI/PD coverage is less than previous carriers — TM must document in ABS why PH went with lower coverage and ensure liability conversation occurred
• Review apps where purchase dates are not older than car model year
• Review apps where prior carrier is none or unrecognizable
• For each TM: sample 10% of apps to verify time with previous insurer on RAZ report agrees with consumer report
• Review SAM report monthly (RAZ000BV)
• Review EUR and go over with TM for one-on-ones if HH quoted more than 2 times
• Review raeap00b agents experience report',
'Complete all auto application compliance reviews monthly. Document findings. Address discrepancies with team members immediately.',
'SF Compliance Review Checklist — Imaginary Farms', 'warning', TRUE);

-- ============================================================
-- CATEGORY 9: DATA PRIVACY AND HIPAA
-- ============================================================

INSERT INTO compliance_rules (agency_id, rule_code, category, title, description, requirement, source, severity, is_active) VALUES

('AGENCY_ID_PLACEHOLDER'::UUID, 'PRIV-001', 'data_privacy', 'Customer Data — State Farm Trade Secret Status',
'Customer information (names, addresses, ages, property descriptions, policy dates, account and investment information) constitutes State Farm''s TRADE SECRETS and CONFIDENTIAL BUSINESS INFORMATION wholly owned by the Companies under AA05 Section I.F. This is a property violation, not merely a privacy issue. At termination, ALL customer data must be returned within 10 days. Agents have access to this information ONLY for State Farm business purposes.',
'Treat all customer information as SF trade secrets. Never share, copy, or use customer data outside SF business purposes. Return all customer records within 10 days of any termination.',
'AA05 Section I.F — Customer Data as Trade Secrets', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'PRIV-002', 'data_privacy', 'HIPAA Compliance — PHI Handling and Breach Protocol',
'HIPAA Business Associate Amendment (AMD99) requires: administrative, physical, and technical PHI safeguards; report suspected breaches within 48 hours to 1-877-766-6371 AND written notice to Chief Privacy Officer; periodic privacy and security training for staff; confidentiality agreements with all staff and subcontractors; forward access and amendment requests to State Farm within 2 business days without processing them directly. HIPAA obligations survive agreement termination.',
'Implement PHI safeguards. Report any suspected breach within 48 hours to 1-877-766-6371. Train staff on PHI handling. Execute confidentiality agreements with all staff.',
'HIPAA Business Associate Amendment (AMD99)', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'PRIV-003', 'data_privacy', 'Annual Privacy Notice Distribution',
'Agents must send annual GLBA privacy notice to all active customers by November 30 each year. Use SF-approved privacy notice language only. Document and retain proof of distribution.',
'Send annual privacy notice to all active customers by November 30. Use only SF-approved language. Document distribution.',
'Gramm-Leach-Bliley Act Privacy Rule + State Privacy Requirements', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'PRIV-004', 'data_privacy', 'Written Information Security Program Required',
'Agents must maintain an up-to-date written Information Security Program documenting how the agency protects customer nonpublic personal information. This is reviewed during compliance audits. All employees must sign the compliance handbook acknowledgment.',
'Maintain written Information Security Program. Update annually. Have all employees sign handbook acknowledgment.',
'GLBA Safeguards Rule + SF Compliance Review Checklist', 'warning', TRUE);

-- ============================================================
-- CATEGORY 10: MEDICARE AND SPECIALIZED PRODUCT COMPLIANCE
-- ============================================================

INSERT INTO compliance_rules (agency_id, rule_code, category, title, description, requirement, source, severity, is_active) VALUES

('AGENCY_ID_PLACEHOLDER'::UUID, 'MED-001', 'medicare', 'Medicare Marketing — CMS Strict Prohibitions',
'CMS regulations impose strict rules on Medicare product marketing. PROHIBITED: door-to-door solicitation, telephonic cold calling for Medicare, gifts or meals exceeding $15 CMS limit, marketing in healthcare provider offices (except common areas), claiming to represent Medicare or government, cross-selling non-health products during Medicare appointments, and any appointment without a completed Scope of Appointment. A 48-hour separation is required between SOA completion and appointment when additional health products will be discussed.',
'Complete SOA before all individual Medicare appointments. Never cold call or go door-to-door for Medicare. Stay within $15 CMS gift limit. Never market non-health products during Medicare appointments.',
'CMS Medicare Marketing Guidelines + AA05 Humana Amendment', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'MED-002', 'medicare', 'Scope of Appointment — Documentation Required',
'Scope of Appointment (SOA) documentation is required BEFORE all individual Medicare appointments. SOA must be completed and signed before the appointment. A 48-hour separation is required between SOA completion and appointment for additional health products.',
'Complete and obtain signed SOA before every individual Medicare appointment. Maintain SOA documentation on file. Never conduct Medicare appointment without SOA.',
'CMS SOA Requirements + AA05 Humana Amendment', 'critical', TRUE);

-- ============================================================
-- CATEGORY 11: SOCIAL MEDIA PRE-POST CHECKLIST
-- All 26 items from Social Chef Claude Compliance KB v2.1
-- Section 18 — seeded as individual trackable rules
-- ============================================================

INSERT INTO compliance_rules (agency_id, rule_code, category, title, description, requirement, source, severity, is_active) VALUES

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-01', 'social_media_checklist', 'Pre-Post Check 1 — No Prohibited Topics', 'Content avoids ALL prohibited topics: investment products, mutual funds, college savings plans, specific life/health product names by name, pricing models, internal SF processes, incentive program details, proprietary SF information, claims and underwriting rules, rates and rating processes, budgets and allocations.', 'Verify content does not touch any prohibited topic category before publishing.', 'Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-02', 'social_media_checklist', 'Pre-Post Check 2 — Authorized Language Only', 'Content uses only authorized language. Options instead of solutions. Customer instead of client. May/could instead of will/guarantee. No prohibited words or phrases from the prohibited terms list.', 'Verify all language against the authorized terms list.', 'Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-03', 'social_media_checklist', 'Pre-Post Check 3 — Customer Not Client', '"Customer" is used in all cases. The word "client" is completely absent from the content. AA05 I.B requires this distinction.', 'Find and replace any instance of "client" with "customer" before publishing.', 'AA05 Section I.B + Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-04', 'social_media_checklist', 'Pre-Post Check 4 — Options Not Solutions', '"Options" is used in all cases where "solutions" might appear. The word "solutions" does not appear in the content.', 'Verify "solutions" does not appear anywhere in the content.', 'Social Chef Claude Compliance KB v2.1 — Section 18', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-05', 'social_media_checklist', 'Pre-Post Check 5 — No Absolutes, Guarantees, or Superlatives', 'Content contains no absolute language (always, never), guarantee language (will, promise, proper, ideal), or superlatives about products/services (best, better, great, #1) unless naming a specific award.', 'Scan all content for prohibited absolute, guarantee, and superlative language.', 'AA05 Section I.D + I.N + Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-06', 'social_media_checklist', 'Pre-Post Check 6 — No Expert, Specialist, or World-Class', 'Content does not use the words expert, specialist, world-class, or any other elevated professional title beyond "agent" or "licensed agent."', 'Remove any instance of expert, specialist, world-class, or similar elevated titles.', 'AA05 Section I.O + Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-07', 'social_media_checklist', 'Pre-Post Check 7 — No Scare Tactics or Fear Mongering', 'Content does not use scare tactics, fear-based language, or burden language to motivate action.', 'Replace any fear-based language with educational, empowering alternatives.', 'AA05 Section I.D + Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-08', 'social_media_checklist', 'Pre-Post Check 8 — No Legal or Financial Advice', 'Content does not constitute legal advice, financial advice, or any form of professional advice-giving beyond general education.', 'Verify content educates without advising. Reframe any advice-giving as general information.', 'Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-09', 'social_media_checklist', 'Pre-Post Check 9 — All Trademarks Used Correctly', 'State Farm name immediately followed by "agent." State Farm slogan unaltered if used. Personal Price Plan® written in full with trademark symbol.', 'Verify all trademark usage against brand standards before publishing.', 'Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-10', 'social_media_checklist', 'Pre-Post Check 10 — Personal Price Plan® Correct Usage', 'Personal Price Plan® is written in full with trademark symbol. Consumers "create" their PPP — never "get" it. Not abbreviated as PPP or lowercase.', 'Verify PPP usage meets all brand requirements before publishing.', 'Social Chef Claude Compliance KB v2.1 — Section 18', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-11', 'social_media_checklist', 'Pre-Post Check 11 — AI Disclaimer Included If AI Used in Visuals', 'If AI was used to produce or enhance any images or videos, a required platform disclaimer is included. Examples: "Created with the help of AI" or "AI-generated."', 'Include AI disclaimer on all AI-produced or AI-enhanced visual content.', 'Platform Terms and Conditions + Social Chef Claude Compliance KB v2.1 — Section 18', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-12', 'social_media_checklist', 'Pre-Post Check 12 — Giveaway: Every Participant Receives Item', 'Any giveaway is structured so that every person who takes the specified action receives the item. No element of chance, no "enter to win," no random selection of winners.', 'Verify giveaway structure guarantees item to every participant who takes action.', 'State Farm Giveaway Guidelines (Jul 2025) + Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-13', 'social_media_checklist', 'Pre-Post Check 13 — All Text in English', 'All text in the content is written in English. No tildes, special characters, or in-language text. Exception: preapproved Spanish paid search ads.', 'Verify all original content is written entirely in English.', 'FINRA Rule 2210 + AA05 Section I.D + Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-14', 'social_media_checklist', 'Pre-Post Check 14 — No Pricing Specifics or Premium Amounts', 'Content contains no specific pricing, premium amounts, rate quotes, or language implying knowledge of specific rates.', 'Remove any specific pricing, rate, or premium language from content.', 'AA05 Section I.N + Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-15', 'social_media_checklist', 'Pre-Post Check 15 — Content Does Not Imply Agent Is the Insurer', 'Content does not imply that the agent — rather than State Farm — is the insurance company or underwriter of coverage.', 'Verify content correctly represents agent as distributing SF products, not as an insurer.', 'Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-16', 'social_media_checklist', 'Pre-Post Check 16 — Event Photos: No SF Product Info Visible', 'Photos from events do not contain any visible State Farm product information, policy documents, application forms, or proprietary materials.', 'Review all event photos for visible SF product or policy information before posting.', 'Social Chef Claude Compliance KB v2.1 — Section 18', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-17', 'social_media_checklist', 'Pre-Post Check 17 — No Customer PII or SPI Disclosed', 'Content does not disclose any customer personally identifiable information (PII) or sensitive personal information (SPI) including names, addresses, policy details, or account information.', 'Verify no customer PII or SPI appears anywhere in the content.', 'AA05 Section I.F + Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-18', 'social_media_checklist', 'Pre-Post Check 18 — No PHI Visible in Photos or Videos', 'Photos and videos are clear of any visible Protected Health Information including office paperwork, screen displays, documents, or forms containing health-related information.', 'Review all photos and video backgrounds for visible PHI before publishing.', 'HIPAA BAA (AMD99) + Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-19', 'social_media_checklist', 'Pre-Post Check 19 — Written Release for All Identifiable People', 'Written permission or release has been obtained from every identifiable person in photos or videos in the content.', 'Confirm written releases are on file for all identifiable people in photos/videos before posting.', 'Right of Publicity Laws + Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-20', 'social_media_checklist', 'Pre-Post Check 20 — State License Numbers Included If Required', 'For content in Arkansas (life/annuities) or New Mexico (health), the agent state license number is included. Additional state-specific requirements verified.', 'Include required state license numbers for AR and NM content. Verify other state requirements.', 'State Insurance Department Requirements + Social Chef Claude Compliance KB v2.1 — Section 18', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-21', 'social_media_checklist', 'Pre-Post Check 21 — GBP Posts Are Insurance Products Only', 'Google Business Profile content covers only insurance products. No financial services, banking products, annuities, mutual funds, CDs, or any non-insurance financial product.', 'Verify all GBP content is insurance-only before posting.', 'State Farm Business Accounts Guidelines (Sep 2025) + Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-22', 'social_media_checklist', 'Pre-Post Check 22 — Multi-Office GBP Distinct Listings Verified', 'Each office location has its own distinct GBP listing with its own unique phone number, address, and details. No shared listings or shared phone numbers across locations.', 'Verify each office has its own distinct GBP listing before posting.', 'Social Chef Claude Compliance KB v2.1 — Section 18', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-23', 'social_media_checklist', 'Pre-Post Check 23 — DMs Only on Facebook and Instagram with Privacy Disclaimer', 'Direct messaging is only used on Facebook and Instagram. Any DM response includes the required privacy disclaimer. No unsolicited DMs about products or services.', 'Verify DM activity is limited to Facebook and Instagram with required privacy disclaimer included.', 'Social Chef Claude Compliance KB v2.1 — Section 18', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-24', 'social_media_checklist', 'Pre-Post Check 24 — Staff Posts Reviewed by Agent', 'Any content posted by staff members has been reviewed and approved by the agent before publishing. Agent accepts contractual responsibility for all staff posts under AA05 Section I.P.', 'Review and approve all staff social content before it is published. Document approval.', 'AA05 Section I.P + Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-25', 'social_media_checklist', 'Pre-Post Check 25 — Building Our Brand Guidelines Followed', 'Content follows all State Farm Building Our Brand guidelines for visual identity, logo usage, color standards, and brand voice requirements.', 'Verify content follows all Building Our Brand guidelines before publishing.', 'State Farm Building Our Brand Guidelines', 'warning', TRUE),

('AGENCY_ID_PLACEHOLDER'::UUID, 'CHECKLIST-26', 'social_media_checklist', 'Pre-Post Check 26 — No Referral Rewards Advertised on Social', 'Content does not advertise, express, or share referral rewards on any social media platform. No bank or securities-linked giveaway promotions on social media.', 'Verify content contains no referral reward advertising or bank/securities-linked promotions.', 'State Farm Giveaway Guidelines (Jul 2025) + Social Chef Claude Compliance KB v2.1 — Section 18', 'critical', TRUE);

-- ============================================================
-- COMPLIANCE CALENDAR — Annual and monthly recurring items
-- ============================================================

-- Annual items — December 31
INSERT INTO compliance_calendar (agency_id, compliance_rule_id, title, description, due_date, recurrence, status, alert_days_before)
SELECT 'AGENCY_ID_PLACEHOLDER'::UUID, id,
  'Annual Review: ' || title,
  'Annual compliance review and verification required for: ' || title,
  (DATE_TRUNC('year', NOW()) + INTERVAL '1 year' - INTERVAL '1 day')::DATE,
  'annual', 'upcoming', 30
FROM compliance_rules
WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID
AND rule_code IN ('AA05-005','LIC-001','LIC-002','PRIV-004');

-- Annual Social Media Audit — November 30
INSERT INTO compliance_calendar (agency_id, compliance_rule_id, title, description, due_date, recurrence, status, alert_days_before)
SELECT 'AGENCY_ID_PLACEHOLDER'::UUID, id,
  'Annual Social Media Compliance Audit',
  'Complete annual review of all social media profiles. Verify compliance, accurate contact info, proper disclosures, remove non-compliant content. Apply all 26 checklist items to current active posts.',
  (DATE_TRUNC('year', NOW()) + INTERVAL '11 months')::DATE,
  'annual', 'upcoming', 14
FROM compliance_rules WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND rule_code = 'SM-001' LIMIT 1;

-- Annual Privacy Notice — November 30
INSERT INTO compliance_calendar (agency_id, compliance_rule_id, title, description, due_date, recurrence, status, alert_days_before)
SELECT 'AGENCY_ID_PLACEHOLDER'::UUID, id,
  'Annual Customer Privacy Notice Distribution',
  'Send annual GLBA privacy notice to all active customers using SF-approved language. Document and retain proof of distribution.',
  (DATE_TRUNC('year', NOW()) + INTERVAL '11 months')::DATE,
  'annual', 'upcoming', 30
FROM compliance_rules WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND rule_code = 'PRIV-003';

-- W-2 and 1099 Filing Deadline — January 31
INSERT INTO compliance_calendar (agency_id, compliance_rule_id, title, description, due_date, recurrence, status, alert_days_before)
SELECT 'AGENCY_ID_PLACEHOLDER'::UUID, id,
  'W-2 and 1099-NEC Filing Deadline — January 31',
  'Issue all W-2s and 1099-NECs to recipients. File copies with SSA/IRS. Includes family employee W-2s. Verify proper withholding treatment with CPA before filing.',
  (DATE_TRUNC('year', NOW()) + INTERVAL '1 year' + INTERVAL '30 days')::DATE,
  'annual', 'upcoming', 30
FROM compliance_rules WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND rule_code = 'LIC-001' LIMIT 1;

-- E&O Renewal Tracking — 90 days before expiration placeholder
INSERT INTO compliance_calendar (agency_id, compliance_rule_id, title, description, due_date, recurrence, status, alert_days_before)
SELECT 'AGENCY_ID_PLACEHOLDER'::UUID, id,
  'E&O Insurance Renewal — Begin Process',
  'Begin E&O insurance renewal process. Confirm coverage amounts meet current SF minimums. Provide updated certificate to SF immediately upon renewal.',
  (NOW() + INTERVAL '9 months')::DATE,
  'annual', 'upcoming', 90
FROM compliance_rules WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND rule_code = 'LIC-003';

-- Monthly Auto Application Review
INSERT INTO compliance_calendar (agency_id, compliance_rule_id, title, description, due_date, recurrence, status, alert_days_before)
SELECT 'AGENCY_ID_PLACEHOLDER'::UUID, id,
  'Monthly Auto Application Compliance Review',
  'Pull RAZ000BT report. Review all required auto application metrics. Review SAM report (RAZ000BV). Review agent experience report. Review EUR with TMs for HH quoted more than 2 times.',
  (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
  'monthly', 'upcoming', 7
FROM compliance_rules WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND rule_code = 'LIC-005';

-- Monthly Altered Monies Review
INSERT INTO compliance_calendar (agency_id, compliance_rule_id, title, description, due_date, recurrence, status, alert_days_before)
SELECT 'AGENCY_ID_PLACEHOLDER'::UUID, id,
  'Monthly Altered Monies History Review',
  'Review and document history of Altered Monies for the month. Required standing compliance item. Document completion.',
  (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
  'monthly', 'upcoming', 3
FROM compliance_rules WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND rule_code = 'FIN-007';

-- Monthly PFA Reconciliation
INSERT INTO compliance_calendar (agency_id, compliance_rule_id, title, description, due_date, recurrence, status, alert_days_before)
SELECT 'AGENCY_ID_PLACEHOLDER'::UUID, id,
  'Monthly PFA Bank Statement Reconciliation',
  'Reconcile Premium Fund Account bank statement. Maintain 3 months of reconciled PFA statements. Verify sequential check order. Document completion.',
  (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' + INTERVAL '14 days')::DATE,
  'monthly', 'upcoming', 3
FROM compliance_rules WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND rule_code = 'FIN-001';

-- ============================================================
-- SEED COMPLETE v2.0
-- ============================================================
-- Rules seeded:    57 compliance rules
-- Categories:
--   contract (5)                — AA05 fundamental obligations
--   advertising (5)             — Marketing approval rules
--   social_media (7)            — Platform rules
--   social_media prohibitions(6)— Absolute prohibitions
--   trademark (5)               — Brand standards and GBP
--   giveaways (4)               — Promotional compliance
--   financial (7)               — PFA, benchmarks, chargebacks
--   licensing (5)               — Licenses, CE, E&O, staff
--   data_privacy (4)            — HIPAA, GLBA, trade secrets
--   medicare (2)                — CMS and SOA requirements
--   social_media_checklist (26) — Full 26-item pre-post list
--
-- Calendar items: 8 recurring items (annual and monthly)
--
-- Every rule includes contract citation where applicable.
-- Sources: AA05, KB v2.1, Content Playbook v1.0,
--          Reference Guide, Business Accounts Guidelines,
--          Giveaway Guidelines, Vendor/Paid Advertising,
--          Compliance Review Checklist
--
-- This REPLACES the original 002_seed_compliance_rules.sql
-- ============================================================
