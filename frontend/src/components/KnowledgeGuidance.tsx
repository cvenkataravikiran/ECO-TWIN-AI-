import { useEffect, useState } from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getKnowledgeArticles, type KnowledgeArticleSummary } from '@/services/api';
import styles from './KnowledgeGuidance.module.css';

interface KnowledgeGuidanceProps {
  categories: string[];
  title?: string;
  limit?: number;
  contextSummary?: string;
}

export default function KnowledgeGuidance({
  categories,
  title = 'Relevant sustainability guidance',
  limit = 3,
  contextSummary,
}: KnowledgeGuidanceProps) {
  const [result, setResult] = useState<{
    categoryKey: string;
    articles: KnowledgeArticleSummary[];
    error: string;
  }>({ categoryKey: '', articles: [], error: '' });
  const categoryKey = [...new Set(categories.filter(Boolean))].join(',');
  const selectedCategories = categoryKey.split(',').filter(Boolean);

  useEffect(() => {
    let isMounted = true;
    const requestedCategories = categoryKey.split(',').filter(Boolean);
    if (requestedCategories.length === 0) return () => { isMounted = false; };
    Promise.all(requestedCategories.map((category) => getKnowledgeArticles(category, limit)))
      .then((results) => {
        if (!isMounted) return;
        const uniqueArticles = new Map<string, KnowledgeArticleSummary>();
        results.flat().forEach((article) => uniqueArticles.set(article.id, article));
        setResult({
          categoryKey,
          articles: [...uniqueArticles.values()].slice(0, limit),
          error: '',
        });
      })
      .catch((cause: unknown) => {
        if (!isMounted) return;
        setResult({
          categoryKey,
          articles: [],
          error: cause instanceof Error ? cause.message : 'Knowledge guidance could not be loaded.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [categoryKey, limit]);

  const resultIsCurrent = result.categoryKey === categoryKey;
  const articles = resultIsCurrent ? result.articles : [];
  const error = resultIsCurrent ? result.error : '';
  const loading = selectedCategories.length > 0 && !resultIsCurrent;

  return (
    <section className={styles.panel} aria-label={title}>
      <div className={styles.heading}>
        <BookOpen size={17} />
        <h2>{title}</h2>
      </div>
      <p className={styles.intro}>
        Curated guidance from the EcoPath.AI knowledge base. Check the article’s assumptions and local limitations before acting.
      </p>
      {contextSummary && <p className={styles.contextSummary}>{contextSummary}</p>}
      {loading && <p className={styles.message} role="status">Loading relevant guidance…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!loading && !error && articles.length === 0 && (
        <p className={styles.message}>No guidance is currently mapped to this area.</p>
      )}
      {articles.length > 0 && (
        <div className={styles.articles}>
          {articles.map((article) => (
            <article className={styles.article} key={article.id}>
              <h3>{article.title}</h3>
              <p>{article.summary}</p>
              {article.implementation_steps.length > 0 && (
                <details>
                  <summary>Suggested next steps</summary>
                  <ol>{article.implementation_steps.map((step) => <li key={step}>{step}</li>)}</ol>
                </details>
              )}
              {article.limitations.length > 0 && (
                <p className={styles.limitation}>Limitations: {article.limitations.join(' ')}</p>
              )}
              {article.source_url && (
                <a href={article.source_url} target="_blank" rel="noreferrer">
                  {article.source_publisher || article.source_title || 'Article source'}
                  <ExternalLink size={12} />
                </a>
              )}
            </article>
          ))}
        </div>
      )}
      <Link className={styles.nextStep} to="/action-planner">
        See workspace recommendations in Action Planner
      </Link>
    </section>
  );
}
