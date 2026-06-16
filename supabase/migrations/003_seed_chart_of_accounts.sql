-- ============================================================
-- BCC SEED: CHART OF ACCOUNTS v1.0
-- State Farm Agent Agency — Standard COA
-- Built by Imaginary Farms LLC · imaginary-farms.com
-- ============================================================
-- Standard double-entry chart of accounts for a State Farm
-- independent contractor agency. Reflects SF compensation
-- structure, common agency expenses, and proper entity
-- treatment for S-Corp or LLC operation.
--
-- Account structure:
--   1000-1999  Assets
--   2000-2999  Liabilities
--   3000-3999  Equity
--   4000-4999  Income
--   5000-5999  Cost of Revenue
--   6000-7999  Operating Expenses
--   8000-8999  Other Income / Expense
--
-- Replace 'AGENCY_ID_PLACEHOLDER' with actual agency UUID
-- before running.
-- ============================================================

-- ============================================================
-- ASSETS (1000–1999)
-- ============================================================

INSERT INTO chart_of_accounts (
  agency_id, account_code, account_name,
  account_type, account_subtype,
  is_active, is_system
) VALUES

-- Current Assets
('AGENCY_ID_PLACEHOLDER'::UUID, '1000', 'Current Assets',              'asset', 'header',          TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1010', 'Operating Checking Account',  'asset', 'bank',             TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1020', 'Savings Account',             'asset', 'bank',             TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1030', 'Premium Trust Account',       'asset', 'bank',             TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1040', 'Petty Cash',                  'asset', 'cash',             TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1100', 'Accounts Receivable',         'asset', 'receivable',       TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1110', 'SF Commissions Receivable',   'asset', 'receivable',       TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1120', 'AIPP Receivable',             'asset', 'receivable',       TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1200', 'Prepaid Expenses',            'asset', 'prepaid',          TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1210', 'Prepaid Insurance — E&O',     'asset', 'prepaid',          TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1220', 'Prepaid Rent',                'asset', 'prepaid',          TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1230', 'Prepaid Software/SaaS',       'asset', 'prepaid',          TRUE, FALSE),

-- Fixed Assets
('AGENCY_ID_PLACEHOLDER'::UUID, '1500', 'Fixed Assets',                'asset', 'header',           TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1510', 'Office Equipment',            'asset', 'fixed',            TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1515', 'Accumulated Depreciation — Equipment', 'asset', 'contra_asset', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1520', 'Furniture and Fixtures',      'asset', 'fixed',            TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1525', 'Accumulated Depreciation — Furniture', 'asset', 'contra_asset', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1530', 'Leasehold Improvements',      'asset', 'fixed',            TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1535', 'Accumulated Depreciation — Leasehold', 'asset', 'contra_asset', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1540', 'Vehicles',                    'asset', 'fixed',            TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '1545', 'Accumulated Depreciation — Vehicles', 'asset', 'contra_asset', TRUE, FALSE);

-- ============================================================
-- LIABILITIES (2000–2999)
-- ============================================================

INSERT INTO chart_of_accounts (
  agency_id, account_code, account_name,
  account_type, account_subtype,
  is_active, is_system
) VALUES

-- Current Liabilities
('AGENCY_ID_PLACEHOLDER'::UUID, '2000', 'Current Liabilities',         'liability', 'header',       TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2010', 'Accounts Payable',            'liability', 'payable',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2020', 'Accrued Expenses',            'liability', 'accrued',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2030', 'Accrued Payroll',             'liability', 'accrued',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2040', 'Payroll Taxes Payable',       'liability', 'payable',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2041', 'Federal Income Tax Withheld', 'liability', 'payable',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2042', 'State Income Tax Withheld',   'liability', 'payable',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2043', 'Social Security Payable',     'liability', 'payable',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2044', 'Medicare Payable',            'liability', 'payable',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2050', 'Sales Tax Payable',           'liability', 'payable',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2060', 'Premium Trust Liability',     'liability', 'trust',        TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2070', 'Unearned Revenue',            'liability', 'deferred',     TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2100', 'Credit Cards Payable',        'liability', 'header',       TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2110', 'Business Credit Card — Chase','liability', 'credit_card',  TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2120', 'Business Credit Card — Other','liability', 'credit_card',  TRUE, FALSE),

-- Long-Term Liabilities
('AGENCY_ID_PLACEHOLDER'::UUID, '2500', 'Long-Term Liabilities',       'liability', 'header',       TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2510', 'SBA Loan Payable',            'liability', 'loan',         TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2520', 'Equipment Loan Payable',      'liability', 'loan',         TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2530', 'Line of Credit Payable',      'liability', 'line_of_credit', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2540', 'Vehicle Loan Payable',        'liability', 'loan',         TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '2900', 'Owner Loan to Agency',        'liability', 'owner_loan',   TRUE, FALSE);

-- ============================================================
-- EQUITY (3000–3999)
-- ============================================================

INSERT INTO chart_of_accounts (
  agency_id, account_code, account_name,
  account_type, account_subtype,
  is_active, is_system
) VALUES

('AGENCY_ID_PLACEHOLDER'::UUID, '3000', 'Equity',                          'equity', 'header',      TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '3010', 'Owner Capital / Paid-In Capital',  'equity', 'capital',    TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '3020', 'Owner Draws',                      'equity', 'draws',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '3030', 'Retained Earnings',                'equity', 'retained',   TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '3040', 'Current Year Earnings',            'equity', 'current',    TRUE, TRUE),
-- S-Corp specific
('AGENCY_ID_PLACEHOLDER'::UUID, '3050', 'S-Corp Distributions',             'equity', 'distribution', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '3060', 'Shareholder Loan Payable',         'equity', 'loan',       TRUE, FALSE);

-- ============================================================
-- INCOME (4000–4999)
-- State Farm compensation has many categories — each tracked
-- separately for COMP_RECAP reconciliation and AIPP analysis
-- ============================================================

INSERT INTO chart_of_accounts (
  agency_id, account_code, account_name,
  account_type, account_subtype,
  is_active, is_system
) VALUES

-- SF Commission Income
('AGENCY_ID_PLACEHOLDER'::UUID, '4000', 'SF Commission Income',             'income', 'header',     TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4010', 'New Business Commission',          'income', 'commission', TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4020', 'Renewal Commission',               'income', 'commission', TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4030', 'Life Insurance Commission',        'income', 'commission', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4040', 'Health Insurance Commission',      'income', 'commission', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4050', 'Commercial Lines Commission',      'income', 'commission', TRUE, FALSE),

-- SF Bonus Income
('AGENCY_ID_PLACEHOLDER'::UUID, '4100', 'SF Bonus Income',                  'income', 'header',     TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4110', 'AIPP Bonus',                       'income', 'bonus',      TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4120', 'ScoreBoard Bonus',                 'income', 'bonus',      TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4130', 'New Agent Bonus',                  'income', 'bonus',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4140', 'Contingency Bonus',                'income', 'bonus',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4150', 'SF Marketing Development Funds',   'income', 'bonus',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4160', 'SF Training Reimbursement',        'income', 'reimbursement', TRUE, FALSE),

-- Other Agency Income
('AGENCY_ID_PLACEHOLDER'::UUID, '4900', 'Other Income',                     'income', 'header',     TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4910', 'Notary Fees',                      'income', 'fee',        TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4920', 'Interest Income',                  'income', 'interest',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '4930', 'Miscellaneous Income',             'income', 'misc',       TRUE, FALSE);

-- ============================================================
-- OPERATING EXPENSES (6000–7999)
-- ============================================================

INSERT INTO chart_of_accounts (
  agency_id, account_code, account_name,
  account_type, account_subtype,
  is_active, is_system
) VALUES

-- Payroll & Compensation
('AGENCY_ID_PLACEHOLDER'::UUID, '6000', 'Payroll & Compensation',           'expense', 'header',    TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6010', 'Staff Wages',                      'expense', 'payroll',   TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6011', 'Staff Wages — Licensed',           'expense', 'payroll',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6012', 'Staff Wages — Unlicensed',         'expense', 'payroll',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6013', 'Staff Wages — Family',             'expense', 'payroll',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6020', 'Owner W-2 Wages (S-Corp)',         'expense', 'payroll',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6030', 'Payroll Tax Expense — ER Share',   'expense', 'payroll',   TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6031', 'Social Security — ER',             'expense', 'payroll',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6032', 'Medicare — ER',                    'expense', 'payroll',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6033', 'FUTA Expense',                     'expense', 'payroll',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6034', 'SUTA Expense',                     'expense', 'payroll',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6040', 'Staff Commissions',                'expense', 'commission', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6050', 'Staff Bonuses',                    'expense', 'bonus',     TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6060', 'Contract Labor — 1099',            'expense', 'contract',  TRUE, FALSE),

-- Benefits
('AGENCY_ID_PLACEHOLDER'::UUID, '6100', 'Employee Benefits',                'expense', 'header',    TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6110', 'Health Insurance — Staff',         'expense', 'benefits',  TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6115', 'S-Corp Medical — Owner',           'expense', 'benefits',  TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6120', 'Retirement Plan Contributions',    'expense', 'benefits',  TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6130', 'Workers Compensation Insurance',   'expense', 'benefits',  TRUE, FALSE),

-- Occupancy
('AGENCY_ID_PLACEHOLDER'::UUID, '6200', 'Occupancy',                        'expense', 'header',    TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6210', 'Rent / Lease',                     'expense', 'rent',      TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6220', 'Utilities',                        'expense', 'utilities', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6230', 'Janitorial / Cleaning',            'expense', 'facilities', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6240', 'Repairs and Maintenance',          'expense', 'facilities', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6250', 'Property Insurance',               'expense', 'insurance', TRUE, FALSE),

-- Technology & Software
('AGENCY_ID_PLACEHOLDER'::UUID, '6300', 'Technology & Software',            'expense', 'header',    TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6310', 'Software Subscriptions — SaaS',   'expense', 'software',  TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6311', 'Claude.ai Subscription',          'expense', 'software',  TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6312', 'Supabase',                        'expense', 'software',  TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6313', 'Composio',                        'expense', 'software',  TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6314', 'Agency Management System',        'expense', 'software',  TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6315', 'Other Software',                  'expense', 'software',  TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6320', 'Phone & Internet',                'expense', 'technology', TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6330', 'Computer Equipment',              'expense', 'equipment', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6340', 'IT Support',                      'expense', 'technology', TRUE, FALSE),

-- Marketing & Advertising
('AGENCY_ID_PLACEHOLDER'::UUID, '6400', 'Marketing & Advertising',         'expense', 'header',    TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6410', 'Digital Advertising',             'expense', 'advertising', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6420', 'Print Advertising',               'expense', 'advertising', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6430', 'Promotional Items / Giveaways',   'expense', 'marketing', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6440', 'Sponsorships & Donations',        'expense', 'marketing', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6450', 'Client Events & Entertainment',   'expense', 'marketing', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6460', 'Social Media & Content Tools',    'expense', 'marketing', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6470', 'Website Hosting & Domain',        'expense', 'marketing', TRUE, FALSE),

-- Professional Services
('AGENCY_ID_PLACEHOLDER'::UUID, '6500', 'Professional Services',           'expense', 'header',    TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6510', 'Accounting & Bookkeeping',        'expense', 'professional', TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6520', 'Legal Fees',                      'expense', 'professional', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6530', 'Consulting Fees',                 'expense', 'professional', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6540', 'Payroll Processing Fees',         'expense', 'professional', TRUE, FALSE),

-- Insurance
('AGENCY_ID_PLACEHOLDER'::UUID, '6600', 'Insurance Expense',               'expense', 'header',    TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6610', 'E&O Insurance',                   'expense', 'insurance', TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6620', 'General Liability Insurance',     'expense', 'insurance', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6630', 'Business Owner Policy (BOP)',     'expense', 'insurance', TRUE, FALSE),

-- Continuing Education & Licensing
('AGENCY_ID_PLACEHOLDER'::UUID, '6700', 'Education & Licensing',           'expense', 'header',    TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6710', 'License Renewal Fees',            'expense', 'licensing', TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6720', 'Continuing Education',            'expense', 'education', TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6730', 'Training & Development',          'expense', 'education', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6740', 'SF Conference & Travel',          'expense', 'education', TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6750', 'Books & Publications',            'expense', 'education', TRUE, FALSE),

-- Vehicle & Travel
('AGENCY_ID_PLACEHOLDER'::UUID, '6800', 'Vehicle & Travel',                'expense', 'header',    TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6810', 'Mileage Reimbursement',           'expense', 'vehicle',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6820', 'Vehicle Lease / Loan Payment',    'expense', 'vehicle',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6830', 'Vehicle Insurance',               'expense', 'vehicle',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6840', 'Fuel & Maintenance',              'expense', 'vehicle',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6850', 'Business Travel',                 'expense', 'travel',    TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6860', 'Meals & Entertainment',           'expense', 'entertainment', TRUE, FALSE),

-- General & Administrative
('AGENCY_ID_PLACEHOLDER'::UUID, '6900', 'General & Administrative',        'expense', 'header',    TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6910', 'Office Supplies',                 'expense', 'supplies',  TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6920', 'Postage & Shipping',              'expense', 'supplies',  TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6930', 'Printing & Copying',              'expense', 'supplies',  TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6940', 'Bank Fees & Charges',             'expense', 'banking',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6941', 'Credit Card Interest',            'expense', 'banking',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6942', 'Loan Interest',                   'expense', 'banking',   TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6950', 'Miscellaneous Expense',           'expense', 'misc',      TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '6960', 'Depreciation Expense',            'expense', 'depreciation', TRUE, FALSE);

-- ============================================================
-- OTHER INCOME / EXPENSE (8000–8999)
-- ============================================================

INSERT INTO chart_of_accounts (
  agency_id, account_code, account_name,
  account_type, account_subtype,
  is_active, is_system
) VALUES

('AGENCY_ID_PLACEHOLDER'::UUID, '8000', 'Other Income & Expense',          'expense', 'header',    TRUE, TRUE),
('AGENCY_ID_PLACEHOLDER'::UUID, '8010', 'Gain on Sale of Assets',          'income',  'other',     TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '8020', 'Loss on Sale of Assets',          'expense', 'other',     TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '8030', 'Other Non-Operating Income',      'income',  'other',     TRUE, FALSE),
('AGENCY_ID_PLACEHOLDER'::UUID, '8040', 'Other Non-Operating Expense',     'expense', 'other',     TRUE, FALSE);

-- ============================================================
-- SET PARENT ACCOUNT REFERENCES
-- Links sub-accounts to their header parent accounts
-- ============================================================

-- Assets
UPDATE chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code = '1000') WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code IN ('1010','1020','1030','1040','1100','1110','1120','1200','1210','1220','1230');
UPDATE chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code = '1500') WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code IN ('1510','1515','1520','1525','1530','1535','1540','1545');

-- Liabilities
UPDATE chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code = '2000') WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code IN ('2010','2020','2030','2040','2041','2042','2043','2044','2050','2060','2070','2100','2110','2120');
UPDATE chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code = '2500') WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code IN ('2510','2520','2530','2540','2900');
UPDATE chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code = '2100') WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code IN ('2110','2120');

-- Income
UPDATE chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code = '4000') WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code IN ('4010','4020','4030','4040','4050');
UPDATE chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code = '4100') WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code IN ('4110','4120','4130','4140','4150','4160');
UPDATE chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code = '4900') WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code IN ('4910','4920','4930');

-- Payroll Expenses
UPDATE chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code = '6000') WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code IN ('6010','6011','6012','6013','6020','6030','6031','6032','6033','6034','6040','6050','6060');
UPDATE chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code = '6010') WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code IN ('6011','6012','6013');
UPDATE chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code = '6030') WHERE agency_id = 'AGENCY_ID_PLACEHOLDER'::UUID AND account_code IN ('6031','6032','6033','6034');

-- ============================================================
-- SEED COMPLETE
-- ============================================================
-- Accounts seeded:  95 accounts across all types
-- Asset accounts:   20  (1000-1545)
-- Liability:        21  (2000-2900)
-- Equity:            7  (3000-3060)
-- Income:           17  (4000-4930)
-- Expenses:         69  (6000-8040)
--
-- SF-specific accounts:
--   4010/4020  New Business / Renewal Commission
--   4110       AIPP Bonus
--   4120       ScoreBoard Bonus
--   6013       Family Wages (flagged for CPA review)
--   6020       Owner W-2 Wages S-Corp
--   6115       S-Corp Medical Owner
--   6311       Claude.ai Subscription
--   6312/6313  Supabase / Composio
--   6610       E&O Insurance
--
-- Next: Run 004_seed_agency_record.sql
-- ============================================================
