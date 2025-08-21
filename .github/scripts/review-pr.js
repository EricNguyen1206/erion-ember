const fs = require('fs');
const https = require('https');

// ============================================================================
// Configuration - Generic AI Provider
// ============================================================================

// AI API Configuration (from environment variables)
const AI_API_URL = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

const isDryRun = process.argv.includes('--dry-run');

// ============================================================================
// Diff Parser
// ============================================================================

function parseDiff(diffText) {
  const files = [];
  const filePattern = /^diff --git a\/(.+?) b\/(.+?)$/gm;
  const hunkPattern = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/;

  let match;
  const fileMatches = [];

  while ((match = filePattern.exec(diffText)) !== null) {
    fileMatches.push({
      path: match[2],
      startIndex: match.index,
    });
  }

  for (let i = 0; i < fileMatches.length; i++) {
    const fileMatch = fileMatches[i];
    const endIndex = i < fileMatches.length - 1 
      ? fileMatches[i + 1].startIndex 
      : diffText.length;
    
    const fileContent = diffText.slice(fileMatch.startIndex, endIndex);
    const lines = fileContent.split('\n');
    
    const fileDiff = {
      path: fileMatch.path,
      hunks: [],
      additions: [],
      deletions: [],
    };

    let currentHunk = null;
    let position = 0;
    let oldLine = 0;
    let newLine = 0;

    for (const line of lines) {
      const hunkMatch = line.match(hunkPattern);
      
      if (hunkMatch) {
        if (currentHunk) {
          fileDiff.hunks.push(currentHunk);
        }
        
        oldLine = parseInt(hunkMatch[1], 10);
        newLine = parseInt(hunkMatch[3], 10);
        
        currentHunk = {
          oldStart: oldLine,
          oldCount: parseInt(hunkMatch[2] || '1', 10),
          newStart: newLine,
          newCount: parseInt(hunkMatch[4] || '1', 10),
          lines: [],
        };
        position = 0;
      } else if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
        position++;
        
        if (line.startsWith('+') && !line.startsWith('+++')) {
          const diffLine = {
            type: 'add',
            content: line.substring(1),
            oldLineNumber: null,
            newLineNumber: newLine,
            position,
          };
          currentHunk.lines.push(diffLine);
          fileDiff.additions.push(line.substring(1));
          newLine++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          const diffLine = {
            type: 'delete',
            content: line.substring(1),
            oldLineNumber: oldLine,
            newLineNumber: null,
            position,
          };
          currentHunk.lines.push(diffLine);
          fileDiff.deletions.push(line.substring(1));
          oldLine++;
        } else if (line.startsWith(' ')) {
          const diffLine = {
            type: 'context',
            content: line.substring(1),
            oldLineNumber: oldLine,
            newLineNumber: newLine,
            position,
          };
          currentHunk.lines.push(diffLine);
          oldLine++;
          newLine++;
        }
      }
    }

    if (currentHunk) {
      fileDiff.hunks.push(currentHunk);
    }

    if (fileDiff.hunks.length > 0) {
      files.push(fileDiff);
    }
  }

  return files;
}

// ============================================================================
// AI Integration - Generic Provider
// ============================================================================

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callAIAPIWithRetry(messages, retryCount = 0) {
  try {
    return await callAIAPI(messages);
  } catch (error) {
    const errorMessage = error.message;
    const isRetryable = errorMessage.includes('503') || 
                        errorMessage.includes('502') || 
                        errorMessage.includes('429') ||
                        errorMessage.includes('timeout') ||
                        errorMessage.includes('ECONNRESET');

    if (isRetryable && retryCount < MAX_RETRIES) {
      const delayMs = INITIAL_DELAY_MS * Math.pow(2, retryCount);
      console.error(`[WARN] API call failed (${errorMessage}). Retrying in ${delayMs}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(delayMs);
      return callAIAPIWithRetry(messages, retryCount + 1);
    }

    throw error;
  }
}

async function callAIAPI(messages) {
  if (!AI_API_KEY) {
    throw new Error('AI_API_KEY environment variable is not set');
  }

  const requestBody = JSON.stringify({
    model: AI_MODEL,
    messages: messages,
    stream: false,
  });

  console.error(`[DEBUG] Using AI Provider: ${new URL(AI_API_URL).hostname}`);
  console.error(`[DEBUG] Using model: ${AI_MODEL}`);

  return new Promise((resolve, reject) => {
    const url = new URL(AI_API_URL);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Length': Buffer.byteLength(requestBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API returned status ${res.statusCode}: ${data}`));
          return;
        }

        try {
          const parsed = JSON.parse(data);
          // Handle OpenAI-compatible response format
          if (parsed.choices && parsed.choices[0]?.message?.content) {
            resolve(parsed.choices[0].message.content);
          }
          // Handle Ollama-style response format
          else if (parsed.message && parsed.message.content) {
            resolve(parsed.message.content);
          } else if (parsed.error) {
            reject(new Error(`AI API error: ${parsed.error.message || parsed.error}`));
          } else {
            reject(new Error(`Unexpected response format: ${data.substring(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout after 120 seconds'));
    });

    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    req.write(requestBody);
    req.end();
  });
}

async function reviewFileChanges(file) {
  const systemPrompt = `You are an expert code reviewer. Analyze the code changes and identify specific issues.

You MUST respond with valid JSON only. No markdown, no explanation, just JSON.

Response format:
{
  "issues": [
    {
      "line": <number - the new line number where the issue is>,
      "priority": "<HIGH|MEDIUM|LOW>",
      "review": "<brief description of the issue>",
      "suggestion": "<how to fix or improve>"
    }
  ],
  "summary": "<one sentence overall assessment>"
}

Focus on:
- HIGH: Security vulnerabilities, critical bugs, data loss risks
- MEDIUM: Logic errors, potential bugs, missing error handling
- LOW: Code style, readability, minor improvements

Rules:
1. Only report issues on ADDED lines (lines starting with +)
2. Use the line number from the new file
3. Be specific and actionable
4. If no issues found, return empty issues array
5. Maximum 10 issues per file`;

  let diffContent = '';
  for (const hunk of file.hunks) {
    diffContent += `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@\n`;
    for (const line of hunk.lines) {
      const prefix = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' ';
      const lineNum = line.newLineNumber ? ` (line ${line.newLineNumber})` : '';
      diffContent += `${prefix}${line.content}${lineNum}\n`;
    }
  }

  const userPrompt = `Review this file: ${file.path}

\`\`\`diff
${diffContent}
\`\`\`

Respond with JSON only.`;

  try {
    const response = await callAIAPIWithRetry([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr);
    return parsed;
  } catch (error) {
    console.error(`[ERROR] Failed to review ${file.path}:`, error);
    return { issues: [], summary: 'Review failed' };
  }
}

// ============================================================================
// GitHub API Integration
// ============================================================================

function findPositionForLine(file, targetLine) {
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add' && line.newLineNumber === targetLine) {
        return line.position;
      }
    }
  }
  return null;
}

function formatComment(issue) {
  const priorityEmoji = {
    HIGH: '🔴',
    MEDIUM: '🟡',
    LOW: '🟢',
  };

  return `**${priorityEmoji[issue.priority]} Priority: ${issue.priority}**

**Review:** ${issue.review}

**Suggestion:** ${issue.suggestion}`;
}

async function createPRReview(comments, summary) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;
  const commitId = process.env.COMMIT_SHA;

  if (!token || !repo || !prNumber || !commitId) {
    throw new Error('Missing required environment variables: GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, COMMIT_SHA');
  }

  const [owner, repoName] = repo.split('/');

  const requestBody = JSON.stringify({
    commit_id: commitId,
    body: summary,
    event: comments.length > 0 ? 'COMMENT' : 'APPROVE',
    comments: comments,
  });

  console.error(`[DEBUG] Creating PR review with ${comments.length} comments`);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repoName}/pulls/${prNumber}/reviews`,
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AI-PR-Reviewer',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`[ERROR] GitHub API response: ${data}`);
          reject(new Error(`GitHub API returned status ${res.statusCode}`));
          return;
        }
        console.error('[DEBUG] PR review created successfully');
        resolve();
      });
    });

    req.on('error', (e) => {
      reject(new Error(`GitHub API request failed: ${e.message}`));
    });

    req.write(requestBody);
    req.end();
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    console.error('[INFO] Starting AI Code Review...');

    const diffArg = process.argv.find(arg => arg.startsWith('--diff='));
    const diffPath = diffArg ? diffArg.split('=')[1] : 'pr_diff.txt';
    const diff = fs.readFileSync(diffPath, 'utf8');

    if (!diff.trim()) {
      console.log('## 🤖 AI Code Review\n\n✅ No changes detected in this PR.');
      return;
    }

    const files = parseDiff(diff);
    console.error(`[INFO] Found ${files.length} files with changes`);

    if (files.length === 0) {
      console.log('## 🤖 AI Code Review\n\n✅ No reviewable changes detected.');
      return;
    }

    const allComments = [];
    const fileSummaries = [];

    for (const file of files) {
      if (file.path.match(/\.(md|json|yaml|yml|lock|txt)$/i)) {
        console.error(`[INFO] Skipping non-code file: ${file.path}`);
        continue;
      }

      console.error(`[INFO] Reviewing: ${file.path}`);

      const review = await reviewFileChanges(file);

      if (review.issues.length > 0) {
        fileSummaries.push(`- **${file.path}**: ${review.issues.length} issue(s) found`);

        for (const issue of review.issues) {
          const position = findPositionForLine(file, issue.line);

          if (position !== null) {
            allComments.push({
              path: file.path,
              position: position,
              body: formatComment(issue),
            });
          } else {
            console.error(`[WARN] Could not find position for line ${issue.line} in ${file.path}`);
          }
        }
      } else {
        fileSummaries.push(`- **${file.path}**: ✅ No issues found`);
      }
    }

    const summaryText = `## 🤖 AI Code Review

> Powered by AI

### Summary
${fileSummaries.join('\n')}

**Total Issues: ${allComments.length}**

---
_This is an automated review. Please use your judgment when applying suggestions._`;

    if (isDryRun) {
      console.log('\n=== DRY RUN OUTPUT ===\n');
      console.log('Summary:', summaryText);
      console.log('\nComments:');
      for (const comment of allComments) {
        console.log(`\n[${comment.path}:position=${comment.position}]`);
        console.log(comment.body);
      }
    } else {
      await createPRReview(allComments, summaryText);
      console.log(summaryText);
    }

  } catch (error) {
    console.error('[ERROR]', error);
    console.log(`## ⚠️ AI Code Review

Unable to complete automated review.

**Error:** ${error.message}

_Please review the PR manually._`);
    process.exit(1);
  }
}

main();
