# Fix Gmail Scanner + Replace Notion with Google Sheets
# This script patches Dashboard.jsx

$file = "g:\job tracker project\job-tracker-react\src\Dashboard.jsx"
$content = [System.IO.File]::ReadAllText($file)
$original = $content

Write-Host "File loaded. Size: $($content.Length) chars"

# ============================================================
# FIX 1a: handleGmailMultiScan - maxResults 10->50, 14d->60d
# ============================================================
$before = $content.Length
$content = $content.Replace('maxResults=10&', 'maxResults=50&')
$content = $content.Replace('newer_than:14d', 'newer_than:60d')
$content = $content.Replace('in the last 14 days', 'in the last 60 days')
if ($content.Length -ne $before) { Write-Host "FIX 1a: maxResults and time window updated" }
else { Write-Host "FIX 1a: SKIP - pattern not found" }

# FIX 1b: Detail fetch 15->40 in handleGmailMultiScan
$before = $content.Length
$content = $content.Replace('up to 15 emails', 'up to 40 emails')
$content = $content.Replace('.slice(0, 15)', '.slice(0, 40)')
if ($content.Length -ne $before) { Write-Host "FIX 1b: Detail limit 15->40" }
else { Write-Host "FIX 1b: SKIP" }

# ============================================================
# FIX 2: scanSingleAccount - maxResults 15->50
# ============================================================
$before = $content.Length
$content = $content.Replace('maxResults=15&', 'maxResults=50&')
if ($content.Length -ne $before) { Write-Host "FIX 2a: scanSingleAccount maxResults 15->50" }
else { Write-Host "FIX 2a: SKIP" }

# FIX 2b: Detail limit 20->40
$before = $content.Length
$content = $content.Replace('.slice(0, 20)', '.slice(0, 40)')
if ($content.Length -ne $before) { Write-Host "FIX 2b: scanSingleAccount detail 20->40" }
else { Write-Host "FIX 2b: SKIP" }

# FIX 2c: newer_than:30d -> 60d in scanSingleAccount
$before = $content.Length
$content = $content.Replace('newer_than:30d', 'newer_than:60d')
if ($content.Length -ne $before) { Write-Host "FIX 2c: Time window 30d->60d" }
else { Write-Host "FIX 2c: SKIP" }

# ============================================================
# FIX 3: fetchAndParseEmails - maxResults 35->60
# ============================================================
$before = $content.Length
$content = $content.Replace('maxResults=35', 'maxResults=60')
if ($content.Length -ne $before) { Write-Host "FIX 3a: fetchAndParseEmails maxResults 35->60" }
else { Write-Host "FIX 3a: SKIP" }

# ============================================================
# FIX 4: Broaden handleGmailMultiScan queries
# ============================================================

# Replace the old narrow query patterns with broader ones
$before = $content.Length

# Interview query
$content = $content.Replace(
    'subject:(interview scheduled OR interview invitation OR interview confirmed) from:(careers OR jobs OR hiring OR hr OR noreply OR talent)',
    'subject:(interview OR "invite you" OR "next round" OR "schedule a call" OR "interview confirmed") (from:careers OR from:jobs OR from:hiring OR from:hr OR from:noreply OR from:talent OR from:recruiting OR from:greenhouse.io OR from:lever.co OR from:workday.com OR from:icims.com OR from:smartrecruiters.com OR from:ashbyhq.com) -subject:newsletter -subject:unsubscribe'
)

# Offer query
$content = $content.Replace(
    'subject:(offer letter OR job offer OR we would like to offer OR pleased to offer) from:(careers OR jobs OR hiring OR hr)',
    'subject:("offer letter" OR "job offer" OR "pleased to offer" OR "congratulations" OR "selected for" OR "we are excited") (from:careers OR from:jobs OR from:hiring OR from:hr OR from:recruiting OR from:greenhouse.io OR from:lever.co OR from:workday.com OR from:icims.com OR from:smartrecruiters.com) -subject:newsletter'
)

# Rejected query
$content = $content.Replace(
    'subject:(regret OR unfortunately OR not moving forward OR not selected OR other candidates) from:(careers OR jobs OR hiring OR hr OR noreply)',
    'subject:(unfortunately OR "not moving forward" OR "not selected" OR "other candidates" OR regret OR "will not be proceeding" OR "decided not to") (from:careers OR from:jobs OR from:hiring OR from:hr OR from:noreply OR from:recruiting OR from:greenhouse.io OR from:lever.co OR from:workday.com OR from:icims.com OR from:smartrecruiters.com) -subject:newsletter'
)

# Applied query
$content = $content.Replace(
    'subject:(application received OR thank you for applying OR we received your application OR application submitted) from:(careers OR jobs OR noreply)',
    'subject:("application received" OR "thank you for applying" OR "application submitted" OR "application confirmation" OR "we received your" OR "successfully applied" OR "your application") (from:careers OR from:jobs OR from:noreply OR from:recruiting OR from:greenhouse.io OR from:lever.co OR from:workday.com OR from:icims.com OR from:smartrecruiters.com) -subject:newsletter -subject:unsubscribe'
)

# Screening query
$content = $content.Replace(
    'subject:(screening call OR phone screen OR initial interview OR recruiter would like) from:(careers OR jobs OR hiring OR recruiter OR talent)',
    'subject:("phone screen" OR "screening call" OR "initial call" OR "introductory call" OR recruiter OR "coding challenge" OR assessment OR "take-home" OR "next steps" OR "following up" OR shortlisted) (from:careers OR from:jobs OR from:hiring OR from:recruiter OR from:talent OR from:recruiting OR from:greenhouse.io OR from:lever.co OR from:workday.com OR from:icims.com OR from:smartrecruiters.com) -subject:newsletter'
)

if ($content.Length -ne $before) { Write-Host "FIX 4: handleGmailMultiScan queries broadened" }
else { Write-Host "FIX 4: SKIP - queries not found (may already be patched)" }

# ============================================================
# FIX 5: Broaden scanSingleAccount queries
# ============================================================
$before = $content.Length

# Interview
$content = $content.Replace(
    '(subject:"interview scheduled" OR subject:"interview invitation" OR subject:"interview confirmed") (from:careers OR from:jobs OR from:recruiting OR from:hr OR from:talent)',
    '(subject:interview OR subject:"invite you" OR subject:"next round" OR subject:"schedule a call" OR subject:"interview confirmed") (from:careers OR from:jobs OR from:recruiting OR from:hr OR from:talent OR from:greenhouse.io OR from:lever.co OR from:workday.com OR from:icims.com OR from:smartrecruiters.com)'
)

# Offer
$content = $content.Replace(
    '(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer") (from:careers OR from:jobs OR from:hr OR from:recruiting)',
    '(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer" OR subject:"congratulations" OR subject:"selected for" OR subject:"we are excited") (from:careers OR from:jobs OR from:hr OR from:recruiting OR from:greenhouse.io OR from:lever.co OR from:workday.com OR from:icims.com OR from:smartrecruiters.com)'
)

# Rejected
$content = $content.Replace(
    '(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates") (from:careers OR from:jobs OR from:hr OR from:noreply)',
    '(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates" OR subject:"regret" OR subject:"will not be proceeding" OR subject:"decided not to") (from:careers OR from:jobs OR from:hr OR from:noreply OR from:recruiting OR from:greenhouse.io OR from:lever.co OR from:workday.com OR from:icims.com OR from:smartrecruiters.com)'
)

# Applied
$content = $content.Replace(
    '(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted")',
    '(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted" OR subject:"application confirmation" OR subject:"we received your" OR subject:"successfully applied" OR subject:"your application")'
)

# Screening
$content = $content.Replace(
    '(subject:"phone screen" OR subject:"screening call" OR subject:"initial call") (from:careers OR from:jobs OR from:recruiting OR from:hr OR from:talent)',
    '(subject:"phone screen" OR subject:"screening call" OR subject:"initial call" OR subject:"introductory call" OR subject:recruiter OR subject:"coding challenge" OR subject:assessment OR subject:"take-home" OR subject:"next steps" OR subject:"following up" OR subject:shortlisted) (from:careers OR from:jobs OR from:recruiting OR from:hr OR from:talent OR from:greenhouse.io OR from:lever.co OR from:workday.com OR from:icims.com OR from:smartrecruiters.com)'
)

if ($content.Length -ne $before) { Write-Host "FIX 5: scanSingleAccount queries broadened" }
else { Write-Host "FIX 5: SKIP" }

# ============================================================
# FIX 6: Broaden fetchAndParseEmails queries
# ============================================================
$before = $content.Length
$content = $content.Replace(
    'subject:"unfortunately" OR subject:"screening call" OR subject:"phone screen")',
    'subject:"unfortunately" OR subject:"not selected" OR subject:"regret" OR subject:"screening call" OR subject:"phone screen" OR subject:"coding challenge" OR subject:"assessment" OR subject:"take-home" OR subject:"next steps" OR subject:"congratulations" OR subject:"selected for" OR subject:"following up" OR subject:"shortlisted")'
)
if ($content.Length -ne $before) { Write-Host "FIX 6: fetchAndParseEmails queries broadened" }
else { Write-Host "FIX 6: SKIP" }

# ============================================================
# FIX 7: Replace Notion state with Sheets state
# ============================================================
$before = $content.Length
$content = $content.Replace('notionToken', 'sheetsSpreadsheetId')
$content = $content.Replace('notionDbId', 'sheetsEnabled')
$content = $content.Replace('notionSyncing', 'sheetsSyncing')
$content = $content.Replace('setNotionToken', 'setSheetsSpreadsheetId')
$content = $content.Replace('setNotionDbId', 'setSheetsEnabled')
$content = $content.Replace('setNotionSyncing', 'setSheetsSyncing')

# Fix the localStorage keys too
$content = $content.Replace('"sheetsSpreadsheetId") || ""', '"sheetsSpreadsheetId") || ""')
$content = $content.Replace('localStorage.getItem("sheetsEnabled")  || ""', 'localStorage.getItem("sheetsEnabled") === "true"')

if ($content.Length -ne $before) { Write-Host "FIX 7: Notion state -> Sheets state vars" }
else { Write-Host "FIX 7: SKIP" }

# ============================================================
# FIX 8: Replace syncToNotion with syncToGoogleSheets
# ============================================================
$before = $content.Length

# Replace the function name and its body
$content = $content.Replace('// ── Notion Sync ', '// ── Google Sheets Sync (free alternative to Notion) ')
$content = $content.Replace('async function syncToNotion(jobsToSync)', 'async function syncToGoogleSheets(jobsToSync)')
$content = $content.Replace('syncToNotion()', 'syncToGoogleSheets()')

# Replace the check at the top of the function
$content = $content.Replace(
    'if (!sheetsSpreadsheetId) return notify("Add your Notion Integration Token',
    'if (!clientId) return notify("Add Google Client ID'
)
$content = $content.Replace(
    'if (!sheetsEnabled)  return notify("Add your Notion Database ID',
    '// sheetsEnabled check removed - Google Sheets needs no config'
)

if ($content.Length -ne $before) { Write-Host "FIX 8: syncToNotion -> syncToGoogleSheets" }
else { Write-Host "FIX 8: SKIP" }

# ============================================================
# FIX 9: Update toolbar button
# ============================================================
$before = $content.Length
$content = $content.Replace('"📝 Notion"', '"📊 Sheets"')
$content = $content.Replace('Notion ✓', 'Google Sheets ✓')
if ($content.Length -ne $before) { Write-Host "FIX 9: Toolbar button text updated" }
else { Write-Host "FIX 9: SKIP" }

# ============================================================
# FIX 10: Update Settings UI labels
# ============================================================
$before = $content.Length
$content = $content.Replace('📝 Notion Sync', '📊 Google Sheets Sync')
$content = $content.Replace('Export jobs to Notion', 'Free • No setup needed')
$content = $content.Replace('Jobs to Notion Now', 'Jobs to Google Sheets')
$content = $content.Replace('Integration Token', 'Spreadsheet ID (auto-created)')
$content = $content.Replace('notion.so/my-integrations', 'Auto-created on first sync')
$content = $content.Replace('Database ID', 'Sync Status')
$content = $content.Replace('32 chars from Notion DB URL', 'Connected via Google OAuth')
$content = $content.Replace('rgba(139,92,246,0.06)', 'rgba(34,197,94,0.06)')
$content = $content.Replace('rgba(139,92,246,0.22)', 'rgba(34,197,94,0.22)')
$content = $content.Replace('#a78bfa', '#4ade80')
$content = $content.Replace('rgba(139,92,246,0.12)', 'rgba(34,197,94,0.12)')
$content = $content.Replace('rgba(139,92,246,0.3)', 'rgba(34,197,94,0.3)')
$content = $content.Replace('#4c1d95', '#065f46')
$content = $content.Replace('#5b21b6', '#047857')
$content = $content.Replace('#c4b5fd', '#a7f3d0')
if ($content.Length -ne $before) { Write-Host "FIX 10: Settings UI labels updated" }
else { Write-Host "FIX 10: SKIP" }

# ============================================================
# Write output
# ============================================================
if ($content -ne $original) {
    [System.IO.File]::WriteAllText($file, $content)
    $newSize = (Get-Item $file).Length
    Write-Host "`nAll patches applied! File saved. New size: $newSize bytes"
} else {
    Write-Host "`nWARNING: No changes were made to the file."
}
