const fs = require('fs');
const file = 'g:/job tracker project/job-tracker-react/src/Dashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const ATS = "from:greenhouse.io OR from:lever.co OR from:workday.com OR from:myworkdayjobs.com OR from:icims.com OR from:smartrecruiters.com OR from:ashbyhq.com OR from:bamboohr.com OR from:jazz.co";
const HIR = "from:careers OR from:jobs OR from:hiring OR from:hr OR from:noreply OR from:talent OR from:recruiting OR from:recruit OR from:team OR from:people OR from:no-reply";
const EXCL = "-subject:newsletter -subject:unsubscribe -subject:promotion";

const newQueries = `const GMAIL_QUERIES = [
        { label: "Interview Scheduled",   q: \`(subject:interview OR subject:"invite you" OR subject:"next round" OR subject:"schedule a call" OR subject:"interview confirmed") (\${HIR} OR \${ATS}) \${EXCL}\` },
        { label: "Offer Received",        q: \`(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer" OR subject:"congratulations" OR subject:"selected for" OR subject:"we are excited") (\${HIR} OR \${ATS}) \${EXCL}\` },
        { label: "Rejected",              q: \`(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates" OR subject:"regret" OR subject:"will not be proceeding") (\${HIR} OR \${ATS}) \${EXCL}\` },
        { label: "Applied",               q: \`(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted" OR subject:"application confirmation" OR subject:"we received your" OR subject:"successfully applied" OR subject:"your application") (\${HIR} OR \${ATS}) \${EXCL}\` },
        { label: "Screening",             q: \`(subject:"phone screen" OR subject:"screening call" OR subject:"initial call" OR subject:"introductory call" OR subject:"recruiter" OR subject:"let's connect") (\${HIR} OR \${ATS}) \${EXCL}\` },
        { label: "Assessment",            q: \`(subject:"coding challenge" OR subject:"assessment" OR subject:"take-home" OR subject:"online test" OR subject:"technical test" OR subject:"hackerrank" OR subject:"codility") (\${HIR} OR \${ATS}) \${EXCL}\` },
        { label: "Follow-up",             q: \`(subject:"next steps" OR subject:"following up" OR subject:"update on your" OR subject:"shortlisted" OR subject:"moved forward") (\${HIR} OR \${ATS}) \${EXCL}\` },
      ];`;

content = content.replace(/const GMAIL_QUERIES = \[\s*\{ label: "Interview Scheduled"[\s\S]+?\];/, newQueries);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed syntax error in GMAIL_QUERIES');
