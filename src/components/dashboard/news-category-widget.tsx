"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Newspaper, Tag, Loader2, AlertCircle } from 'lucide-react';
import type { NewsArticle as AppNewsArticle, NewsCategory } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { processRssFeed } from '@/ai/flows/rss-processor-flow';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const MAX_ARTICLES_DISPLAY_TOTAL = 50;

interface NewsCategoryWidgetProps {
  category: NewsCategory;
}

export function NewsCategoryWidget({ category }: NewsCategoryWidgetProps) {
  const [articles, setArticles] = useState<AppNewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClientLoaded, setIsClientLoaded] = useState(false);

  useEffect(() => {
    setIsClientLoaded(true);
  }, []);

  useEffect(() => {
    const fetchAndProcessFeeds = async () => {
      if (!category || category.feeds.length === 0) {
        setArticles([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      let collectedErrorMessages: string[] = [];

      const articlePromises = category.feeds.map(async (feed) => {
        try {
          const result = await processRssFeed({ rssFeedUrl: feed.url });
          return result.articles.map(article => ({
            ...article,
            sourceName: feed.userLabel || result.sourceName,
            id: `${feed.id}-${article.link || article.title || article.isoDate || Math.random()}`,
          }));
        } catch (err) {
          let detail = "Failed to fetch or parse feed.";
          if (err instanceof Error) {
            detail = `Error for ${feed.userLabel || 'feed'}: ${err.message}`;
          }
          collectedErrorMessages.push(detail);
          return [];
        }
      });

      const results = await Promise.allSettled(articlePromises);

      let fetchedArticles: AppNewsArticle[] = [];
      results.forEach(result => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          fetchedArticles.push(...result.value as AppNewsArticle[]);
        }
      });

      fetchedArticles.sort((a, b) => {
        if (a.isoDate && b.isoDate) return new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime();
        return 0;
      });

      setArticles(fetchedArticles.slice(0, MAX_ARTICLES_DISPLAY_TOTAL));

      if (collectedErrorMessages.length > 0) {
        const fullErrorMessage = collectedErrorMessages.join('; ');
        setError(fullErrorMessage);
        toast({
          title: `RSS Feed Issues in ${category.name}`,
          description: fullErrorMessage.substring(0, 100) + '...',
          variant: "destructive",
          duration: 8000,
        });
      }

      setIsLoading(false);
    };

    if (isClientLoaded) {
      fetchAndProcessFeeds();
    }
  }, [category, isClientLoaded]);

  const isValidHexColor = (color: string) => /^#([0-9A-F]{3}){1,2}$/i.test(color);
  const categoryColor = (category.color && isValidHexColor(category.color)) ? category.color : 'hsl(var(--border))';

  return (
    <Card 
        className="shadow-md flex flex-col" 
        style={{ borderTop: `4px solid ${categoryColor}` }}
    >
      <CardHeader className="p-3">
         <CardTitle className="text-lg flex items-center truncate">
           <Newspaper className="mr-2 h-5 w-5 flex-shrink-0" style={{ color: categoryColor }}/>
           <span className="truncate" title={category.name}>{category.name}</span>
         </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-0 pb-3 flex-1 flex flex-col">
        {isLoading ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading articles...</div>
        ) : error ? (
            <div className="p-2 border rounded-md bg-destructive/10 text-destructive text-xs my-2">
                <AlertCircle className="inline h-4 w-4 mr-1" /> {error}
            </div>
        ) : articles.length > 0 ? (
          <ScrollArea className="h-[300px] pr-3 py-2 overflow-y-auto custom-styled-scroll-area">
            <ul className="space-y-4">
              {articles.map((article) => (
                <li key={article.id} className="pb-3 border-b border-border last:border-b-0">
                  {article.imageUrl && (
                      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block mb-2 rounded-md overflow-hidden aspect-[16/9] max-h-32">
                        <Image
                            src={article.imageUrl}
                            alt={article.title || 'Article image'}
                            width={300}
                            height={169} 
                            className="object-cover w-full h-full hover:scale-105 transition-transform duration-200"
                            data-ai-hint="news article"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </a>
                  )}
                  <a href={article.link} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    <h4 className="font-medium text-card-foreground leading-tight">{article.title || 'Untitled Article'}</h4>
                  </a>
                  <p className="text-xs text-muted-foreground mt-1">
                    {article.isoDate && `${formatDistanceToNow(new Date(article.isoDate), { addSuffix: true })}`}
                  </p>
                  {article.contentSnippet && (
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-3">{article.contentSnippet}</p>
                  )}
                  {article.sourceName && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      <Tag className="w-3 h-3 mr-1" />
                      {article.sourceName}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
            <p className="text-sm text-muted-foreground py-4 px-2 text-center">
                {category.feeds.length > 0 ? "No articles found from the configured feeds." : "No RSS feeds configured for this category."}
            </p>
        )}
      </CardContent>
    </Card>
  );
}
