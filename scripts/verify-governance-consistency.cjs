const fs = require('fs');
const path = require('path');

function writeOptionalReport(requiredChecks, docsToCheck) {
  const lines = [
    '# Governance Required Checks',
    '',
    'Branch protection should include these required status checks:',
    ...requiredChecks.map((check) => `- [ ] ${check}`),
    '',
    'Validated documentation files:',
    ...docsToCheck.map((docPath) => `- ${docPath}`),
    '',
    `Generated at (UTC): ${new Date().toISOString()}`,
    '',
  ];

  const markdown = lines.join('\n');
  const reportPath = (process.env.GOVERNANCE_REPORT_PATH || '').trim();

  if (reportPath) {
    const absoluteReportPath = path.join(process.cwd(), reportPath);
    fs.mkdirSync(path.dirname(absoluteReportPath), { recursive: true });
    fs.writeFileSync(absoluteReportPath, markdown, 'utf8');
  }

  const stepSummaryPath = (process.env.GITHUB_STEP_SUMMARY || '').trim();
  if (stepSummaryPath) {
    fs.appendFileSync(stepSummaryPath, `${markdown}\n`, 'utf8');
  }
}

function readWorkspaceFile(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`[governance] Missing file: ${relativePath}`);
  }

  return fs.readFileSync(absolutePath, 'utf8');
}

function readJsonConfig(relativePath) {
  const raw = readWorkspaceFile(relativePath);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `[governance] Invalid JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function ensureIncludes(content, needle, filePath) {
  if (!content.includes(needle)) {
    throw new Error(`[governance] Missing required text in ${filePath}: ${needle}`);
  }
}

function ensureJobId(content, jobId, filePath) {
  const pattern = new RegExp(`^\\s{2}${jobId}:\\s*$`, 'm');
  if (!pattern.test(content)) {
    throw new Error(`[governance] Expected job id '${jobId}' in ${filePath}`);
  }
}

function main() {
  const config = readJsonConfig('.github/governance-consistency.config.json');
  const workflowSpecs = config.workflowSpecs || [];
  const docsToCheck = config.docsToCheck || [];
  const releaseEvidence = config.releaseEvidence || {};

  if (workflowSpecs.length === 0) {
    throw new Error('[governance] Config error: workflowSpecs must include at least one workflow definition.');
  }

  if (docsToCheck.length === 0) {
    throw new Error('[governance] Config error: docsToCheck must include at least one documentation file.');
  }

  const requiredChecks = workflowSpecs.map((spec) => spec.requiredChecksEntry);

  const workflowCache = new Map();
  for (const spec of workflowSpecs) {
    const workflowContent = readWorkspaceFile(spec.filePath);
    workflowCache.set(spec.filePath, workflowContent);

    ensureJobId(workflowContent, spec.jobId, spec.filePath);
  }

  for (const docPath of docsToCheck) {
    const docContent = readWorkspaceFile(docPath);
    for (const spec of workflowSpecs) {
      ensureIncludes(docContent, spec.requiredChecksEntry, docPath);
    }
  }

  const releaseEvidenceWorkflowPath = releaseEvidence.workflowPath;
  const releaseEvidenceTemplatePath = releaseEvidence.templatePath;
  const githubReleaseTemplatePath = releaseEvidence.githubReleaseTemplatePath;
  const requiredEvidenceKeys = releaseEvidence.requiredEvidenceKeys || [];
  const requiredWorkflowRefs = releaseEvidence.requiredWorkflowRefs || [];

  if (!releaseEvidenceWorkflowPath || !releaseEvidenceTemplatePath || !githubReleaseTemplatePath) {
    throw new Error(
      '[governance] Config error: releaseEvidence.workflowPath, templatePath, and githubReleaseTemplatePath are required.'
    );
  }

  const releaseEvidenceWorkflow = readWorkspaceFile(releaseEvidenceWorkflowPath);
  const releaseEvidenceTemplate = readWorkspaceFile(releaseEvidenceTemplatePath);
  const githubReleaseTemplate = readWorkspaceFile(githubReleaseTemplatePath);

  for (const key of requiredEvidenceKeys) {
    ensureIncludes(releaseEvidenceWorkflow, `key: '${key}'`, releaseEvidenceWorkflowPath);
    ensureIncludes(releaseEvidenceTemplate, `${key} run URL:`, releaseEvidenceTemplatePath);
  }

  for (const workflowRef of requiredWorkflowRefs) {
    ensureIncludes(releaseEvidenceWorkflow, workflowRef, releaseEvidenceWorkflowPath);
    ensureIncludes(releaseEvidenceTemplate, workflowRef, releaseEvidenceTemplatePath);
    ensureIncludes(githubReleaseTemplate, workflowRef, githubReleaseTemplatePath);
  }

  writeOptionalReport(requiredChecks, docsToCheck);

  console.log('[governance] PASS: workflows, job ids, required-check docs, and release evidence templates are consistent.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
