#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const PUBMED_SEARCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const PUBMED_FETCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
const HEADERS = { 'User-Agent': 'CannabisResearchBot/1.0 (research aggregator)' };

const JOURNALS = [
  'Addiction',
  'Drug and Alcohol Dependence',
  'Drug and Alcohol Review',
  'Addictive Behaviors',
  'Journal of Substance Abuse Treatment',
  'Journal of Addiction Medicine',
  'American Journal on Addictions',
  'Substance Abuse',
  'Experimental and Clinical Psychopharmacology',
  'Psychology of Addictive Behaviors',
  'Substance Use & Misuse',
  'International Journal of Drug Policy',
  'Harm Reduction Journal',
  'American Journal of Psychiatry',
  'JAMA Psychiatry',
  'The Lancet Psychiatry',
  'Molecular Psychiatry',
  'Biological Psychiatry',
  'Psychological Medicine',
  'Neuropsychopharmacology',
  'Journal of Clinical Psychiatry',
  'Schizophrenia Bulletin',
  'Depression and Anxiety',
  'Journal of Affective Disorders',
  'Addiction Biology',
  'Neuropharmacology',
  'Psychopharmacology',
  'Clinical Psychology Review',
  'Journal of Consulting and Clinical Psychology',
  'American Journal of Public Health',
  'JAMA Network Open',
  'BMC Public Health',
  'Preventive Medicine',
  'Journal of Adolescent Health',
  'Pediatrics',
  'Schizophrenia Research',
  'Frontiers in Psychiatry',
  'European Neuropsychopharmacology',
  'European Journal of Public Health',
  'Drug and Alcohol Dependence Reports',
];

const CORE_TERMS = [
  '"cannabis use disorder"[tiab]',
  '"cannabis use disorders"[tiab]',
  '"cannabis dependence"[tiab]',
  '"marijuana addiction"[tiab]',
  '"cannabis addiction"[tiab]',
  '"marijuana dependence"[tiab]',
  '"cannabis abuse"[tiab]',
  '"marijuana abuse"[tiab]',
  '"problematic cannabis use"[tiab]',
  '"cannabis withdrawal"[tiab]',
  '"marijuana withdrawal"[tiab]',
  '"cannabis craving"[tiab]',
  '"Marijuana Abuse"[Mesh]',
  '"Marijuana Use"[Mesh]',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { days: 7, maxPapers: 40, output: 'papers.json' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) { opts.days = parseInt(args[++i], 10); }
    else if (args[i] === '--max-papers' && args[i + 1]) { opts.maxPapers = parseInt(args[++i], 10); }
    else if (args[i] === '--output' && args[i + 1]) { opts.output = args[++i]; }
  }
  return opts;
}

function buildQuery(days) {
  const terms = CORE_TERMS.join(' OR ');
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400000);
  const sinceStr = since.toISOString().slice(0, 10).replace(/-/g, '/');
  return `(${terms}) AND ("${sinceStr}"[Date - Publication] : "3000"[Date - Publication])`;
}

function buildJournalQuery(days) {
  const journalPart = JOURNALS.map(j => `"${j}"[Journal]`).join(' OR ');
  const cudTerms = '"cannabis"[tiab] OR "marijuana"[tiab] OR "cannabinoid"[tiab]';
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400000);
  const sinceStr = since.toISOString().slice(0, 10).replace(/-/g, '/');
  return `(${journalPart}) AND (${cudTerms}) AND ("${sinceStr}"[Date - Publication] : "3000"[Date - Publication])`;
}

async function searchPapers(query, retmax) {
  const url = `${PUBMED_SEARCH}?db=pubmed&term=${encodeURIComponent(query)}&retmax=${retmax}&sort=date&retmode=json`;
  const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`PubMed search HTTP ${resp.status}`);
  const data = await resp.json();
  return data?.esearchresult?.idlist || [];
}

async function fetchDetails(pmids) {
  if (!pmids.length) return [];
  const ids = pmids.join(',');
  const url = `${PUBMED_FETCH}?db=pubmed&id=${ids}&retmode=xml`;
  const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
  if (!resp.ok) throw new Error(`PubMed fetch HTTP ${resp.status}`);
  const xml = await resp.text();
  return parseXml(xml);
}

function parseXml(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    tagValueProcessor: (_, val) => (typeof val === 'string' ? val.trim() : val),
  });
  const parsed = parser.parse(xml);
  const articles = [];

  const pubmedArticles = parsed?.PubmedArticleSet?.PubmedArticle;
  if (!pubmedArticles) return articles;

  const list = Array.isArray(pubmedArticles) ? pubmedArticles : [pubmedArticles];

  for (const item of list) {
    try {
      const medline = item.MedlineCitation;
      const article = medline?.Article;
      if (!article) continue;

      const titleEl = article.ArticleTitle;
      const title = typeof titleEl === 'string' ? titleEl : (titleEl?.['#text'] || String(titleEl || ''));

      const abstractParts = [];
      const abstractEl = article.Abstract;
      if (abstractEl) {
        const texts = abstractEl.AbstractText;
        const textList = Array.isArray(texts) ? texts : texts ? [texts] : [];
        for (const part of textList) {
          const label = part['@_Label'] || '';
          const text = typeof part === 'string' ? part : (part['#text'] || '');
          if (label && text) abstractParts.push(`${label}: ${text}`);
          else if (text) abstractParts.push(text);
        }
      }
      const abstract = abstractParts.join(' ').slice(0, 2000);

      const journal = article.Journal?.Title || '';
      const pubDate = article.Journal?.JournalIssue?.PubDate;
      let dateStr = '';
      if (pubDate) {
        const y = pubDate.Year || '';
        const m = pubDate.Month || '';
        const d = pubDate.Day || '';
        dateStr = [y, m, d].filter(Boolean).join(' ');
      }

      const pmid = String(medline.PMID?.['#text'] || medline.PMID || '');
      const link = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : '';

      const keywords = [];
      const kwList = medline.KeywordList;
      if (kwList) {
        const kwArrays = Array.isArray(kwList) ? kwList : [kwList];
        for (const kl of kwArrays) {
          const kws = kl.Keyword;
          const kwArr = Array.isArray(kws) ? kws : kws ? [kws] : [];
          for (const kw of kwArr) {
            const t = typeof kw === 'string' ? kw : (kw?.['#text'] || '');
            if (t) keywords.push(t);
          }
        }
      }

      articles.push({ pmid, title, journal, date: dateStr, abstract, url: link, keywords });
    } catch (e) {
      console.error(`[WARN] Failed to parse article: ${e.message}`);
    }
  }
  return articles;
}

function loadSummarizedPmids() {
  const path = resolve('docs/summarized_pmids.json');
  if (!existsSync(path)) return new Set();
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return new Set(data.pmids || []);
  } catch {
    return new Set();
  }
}

function getTaipeiDate() {
  const now = new Date();
  const taipei = new Date(now.getTime() + 8 * 3600000);
  return taipei.toISOString().slice(0, 10);
}

async function main() {
  const opts = parseArgs();
  console.error(`[INFO] Fetching papers from last ${opts.days} days (max ${opts.maxPapers})...`);

  const query1 = buildQuery(opts.days);
  const query2 = buildJournalQuery(opts.days);

  let pmids;
  try {
    const r1 = await searchPapers(query1, Math.floor(opts.maxPapers / 2));
    console.error(`[INFO] Core CUD terms found ${r1.length} papers`);
    const r2 = await searchPapers(query2, Math.floor(opts.maxPapers / 2));
    console.error(`[INFO] Journal-filtered found ${r2.length} papers`);
    const unique = [...new Set([...r1, ...r2])];
    pmids = unique.slice(0, opts.maxPapers);
  } catch (e) {
    console.error(`[ERROR] Search failed: ${e.message}`);
    pmids = [];
  }

  console.error(`[INFO] Fetching details for ${pmids.length} unique papers...`);
  let papers;
  try {
    papers = await fetchDetails(pmids);
    console.error(`[INFO] Successfully parsed ${papers.length} papers`);
  } catch (e) {
    console.error(`[ERROR] Fetch details failed: ${e.message}`);
    papers = [];
  }

  const summarized = loadSummarizedPmids();
  const newPapers = papers.filter(p => !summarized.has(p.pmid));
  console.error(`[INFO] ${newPapers.length} new papers (${papers.length - newPapers.length} already summarized)`);

  const output = {
    date: getTaipeiDate(),
    count: newPapers.length,
    totalCount: papers.length,
    papers: newPapers,
  };

  const json = JSON.stringify(output, null, 2);
  writeFileSync(opts.output, json, 'utf-8');
  console.error(`[INFO] Saved ${newPapers.length} new papers to ${opts.output}`);
}

main().catch(e => {
  console.error(`[FATAL] ${e.message}`);
  process.exit(1);
});
