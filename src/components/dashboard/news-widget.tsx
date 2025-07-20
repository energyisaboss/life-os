"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, PlusCircle, Trash2, Edit3, FolderPlus, FolderMinus, FilePlus, CheckCircle, Palette } from 'lucide-react';
import type { NewsCategory, RssFeedSource } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const MAX_CATEGORIES = 10;
const MAX_FEEDS_PER_CATEGORY = 7;
export const LOCALSTORAGE_KEY_CATEGORIES = 'rssCategoriesLifeOS_v3'; 

const predefinedNewsCategoryColors: {name: string, value: string}[] = [
  { name: 'Red', value: '#F44336' },
  { name: 'Blue', value: '#2196F3' },
  { name: 'Orange', value: '#FF9800' },
  { name: 'Yellow', value: '#FFEB3B' },
  { name: 'Green', value: '#4CAF50' },
  { name: 'Purple', value: '#9C27B0' },
];
let lastAssignedCategoryColorIndex = -1;

const getNextCategoryColor = () => {
  lastAssignedCategoryColorIndex = (lastAssignedCategoryColorIndex + 1) % predefinedNewsCategoryColors.length;
  return predefinedNewsCategoryColors[lastAssignedCategoryColorIndex].value;
};

const isValidHexColor = (color: string) => {
  return /^#([0-9A-F]{3}){1,2}$/i.test(color);
}

interface NewsWidgetSettingsProps {
  // This component is now only for settings.
}

export function NewsWidget({}: NewsWidgetSettingsProps) {
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryState, setEditingCategoryState] = useState<{ [key: string]: { name: string; color: string } }>({});
  
  const [editingFeed, setEditingFeed] = useState<{ categoryId: string; feedId?: string; url: string; userLabel: string } | null>(null);
  const [isClientLoaded, setIsClientLoaded] = useState(false);

  useEffect(() => {
    setIsClientLoaded(true);
    const savedCategories = localStorage.getItem(LOCALSTORAGE_KEY_CATEGORIES);
    try {
      const parsed = savedCategories ? JSON.parse(savedCategories) : [];
      if (Array.isArray(parsed)) {
        setCategories(parsed.map((cat: any) => ({
          id: cat.id || `cat-${Date.now()}-${Math.random()}`,
          name: cat.name || 'Untitled Category',
          feeds: Array.isArray(cat.feeds) ? cat.feeds.map((feed: any) => ({
            id: feed.id || `feed-${Date.now()}-${Math.random()}`,
            url: feed.url || '',
            userLabel: feed.userLabel || 'Untitled Feed',
          })) : [],
          isEditingName: false,
          color: cat.color && isValidHexColor(cat.color) ? cat.color : getNextCategoryColor(), 
        })));
      } else {
        setCategories([]);
      }
    } catch (e) {
      console.error("NewsWidget: Failed to parse RSS categories from localStorage", e);
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    if (isClientLoaded) {
      localStorage.setItem(LOCALSTORAGE_KEY_CATEGORIES, JSON.stringify(categories.map(c => ({...c, isEditingName: undefined}))));
    }
  }, [categories, isClientLoaded]);

  const handleAddCategory = useCallback(() => {
    if (!newCategoryName.trim()) {
      toast({ title: "Category Name Required", variant: "destructive" });
      return;
    }
    if (categories.length >= MAX_CATEGORIES) {
      toast({ title: "Category Limit Reached", description: `Max ${MAX_CATEGORIES} categories.`, variant: "destructive" });
      return;
    }
    setCategories(prev => [
      ...prev,
      { 
        id: `cat-${Date.now()}-${Math.random().toString(36).substring(2,9)}`, 
        name: newCategoryName.trim(), 
        feeds: [], 
        isEditingName: false,
        color: getNextCategoryColor()
      }
    ]);
    setNewCategoryName('');
    toast({ title: "Category Added", description: `"${newCategoryName.trim()}" added.`});
  }, [newCategoryName, categories]);

  const handleToggleEditCategoryName = useCallback((categoryId: string) => {
    const categoryToEdit = categories.find(cat => cat.id === categoryId);
    if (categoryToEdit) {
      setEditingCategoryState(prev => ({ ...prev, [categoryId]: { name: categoryToEdit.name, color: categoryToEdit.color } }));
      setCategories(prev => prev.map(cat => 
        cat.id === categoryId ? { ...cat, isEditingName: true } : {...cat, isEditingName: false}
      ));
    }
  }, [categories]);
  
  const handleSaveCategoryName = useCallback((categoryId: string) => {
    const currentEditState = editingCategoryState[categoryId];
    const newName = currentEditState?.name?.trim();

    if (!newName) {
      toast({ title: "Category Name Required", variant: "destructive" });
      return;
    }

    setCategories(prev => prev.map(cat =>
      cat.id === categoryId ? { ...cat, name: newName, isEditingName: false, color: currentEditState.color } : cat
    ));
    toast({ title: "Category Name Updated" });
  }, [editingCategoryState]);

  const handleCancelEditCategoryName = (categoryId: string) => {
      setCategories(prev => prev.map(cat => cat.id === categoryId ? { ...cat, isEditingName: false } : cat));
  };


  const handleDeleteCategory = useCallback((categoryId: string) => {
    const categoryToDelete = categories.find(cat => cat.id === categoryId);
    setCategories(prev => prev.filter(cat => cat.id !== categoryId));
    toast({ title: "Category Deleted", description: `"${categoryToDelete?.name}" and its feeds removed.`});
  }, [categories]);

  const handleStartAddOrEditFeed = useCallback((categoryId: string, feed?: RssFeedSource) => {
    if (feed) { 
      setEditingFeed({ categoryId, feedId: feed.id, url: feed.url, userLabel: feed.userLabel });
    } else { 
      const category = categories.find(c => c.id === categoryId);
      if (category && category.feeds.length >= MAX_FEEDS_PER_CATEGORY) {
         toast({ title: "Feed Limit Reached", description: `Max ${MAX_FEEDS_PER_CATEGORY} feeds per category.`, variant: "destructive" });
         return;
      }
      setEditingFeed({ categoryId, url: '', userLabel: '' });
    }
  }, [categories]);

  const handleSaveFeed = useCallback(() => {
    if (!editingFeed || !editingFeed.url.trim()) {
      toast({ title: "Feed URL Required", variant: "destructive" });
      return;
    }
    if (!editingFeed.url.toLowerCase().startsWith('http')) {
        toast({ title: "Invalid URL", description: "Feed URL must start with http(s)://.", variant: "destructive" });
        return;
    }

    setCategories(prev => prev.map(cat => {
      if (cat.id === editingFeed.categoryId) {
        let newFeeds;
        if (editingFeed.feedId) { 
          newFeeds = cat.feeds.map(f => f.id === editingFeed.feedId ? { ...f, url: editingFeed.url.trim(), userLabel: editingFeed.userLabel.trim() || `Feed ${cat.feeds.findIndex(cf => cf.id === f.id) +1}` } : f);
        } else { 
          const newFeedId = `feed-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
          newFeeds = [...cat.feeds, { id: newFeedId, url: editingFeed.url.trim(), userLabel: editingFeed.userLabel.trim() || `Feed ${cat.feeds.length + 1}` }];
        }
        return { ...cat, feeds: newFeeds };
      }
      return cat;
    }));
    
    toast({ title: editingFeed.feedId ? "Feed Updated" : "Feed Added" });
    setEditingFeed(null);
  }, [editingFeed]);

  const handleDeleteFeed = useCallback((categoryId: string, feedId: string) => {
    setCategories(prev => prev.map(cat =>
      cat.id === categoryId ? { ...cat, feeds: cat.feeds.filter(f => f.id !== feedId) } : cat
    ));
    toast({ title: "Feed Deleted" });
  }, []);
  
  const handleCategoryColorChange = useCallback((categoryId: string, newColor: string) => {
    if (newColor !== '' && !isValidHexColor(newColor)) {
      toast({ title: "Invalid Color", description: "Please enter a valid hex color code (e.g. #RRGGBB).", variant: "destructive", duration:3000 });
      return;
    }

    if (editingCategoryState[categoryId]) {
        setEditingCategoryState(prev => ({...prev, [categoryId]: {...prev[categoryId], color: newColor }}));
    }
  }, [editingCategoryState]);

  if (!isClientLoaded) {
      return (
          <div className="p-3 border rounded-lg bg-muted/30 shadow-sm">
              <CardTitle className="text-lg font-semibold mb-4">News Settings</CardTitle>
              <p>Loading settings...</p>
          </div>
      );
  }

  return (
    <div className="p-3 border rounded-lg bg-muted/30 shadow-sm">
      <CardTitle className="text-lg font-semibold mb-4">News Settings</CardTitle>
        <CardContent className="p-1 space-y-4">
            <Card className="p-3 bg-muted/30 rounded-md">
                <Label htmlFor="new-category-name" className="text-xs font-medium">New Category Name</Label>
                <div className="flex gap-2 mt-1">
                <Input
                    id="new-category-name"
                    type="text"
                    placeholder="e.g., Technology, Sports"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="h-9 text-sm"
                />
                <Button size="sm" onClick={handleAddCategory} disabled={categories.length >= MAX_CATEGORIES}>
                    <FolderPlus size={16} className="mr-1.5" /> Add ({categories.length}/{MAX_CATEGORIES})
                </Button>
                </div>
            </Card>

            {editingFeed && (
                <Card className="p-3 my-3 bg-muted/40">
                <Label className="text-xs font-semibold block mb-1">
                    {editingFeed.feedId ? "Edit Feed" : "Add New Feed"} in "{categories.find(c=>c.id === editingFeed.categoryId)?.name}"
                </Label>
                <div className="space-y-2 mt-1">
                    <div>
                    <Label htmlFor="editing-feed-label" className="text-xs">Feed Label (Optional)</Label>
                    <Input
                        id="editing-feed-label"
                        type="text"
                        placeholder="e.g., TechCrunch News"
                        value={editingFeed.userLabel}
                        onChange={(e) => setEditingFeed(ef => ef ? { ...ef, userLabel: e.target.value } : null)}
                        className="h-8 text-xs mt-0.5"
                    />
                    </div>
                    <div>
                    <Label htmlFor="editing-feed-url" className="text-xs">Feed URL*</Label>
                    <Input
                        id="editing-feed-url"
                        type="url"
                        placeholder="https://example.com/feed.xml"
                        value={editingFeed.url}
                        onChange={(e) => setEditingFeed(ef => ef ? { ...ef, url: e.target.value } : null)}
                        className="h-8 text-xs mt-0.5"
                        required
                    />
                    </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingFeed(null)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveFeed}><CheckCircle size={16} className="mr-1.5" /> Save Feed</Button>
                </div>
                </Card>
            )}
            
            <ScrollArea className="max-h-[400px] pr-1 custom-styled-scroll-area overflow-y-auto">
                <div className="space-y-3">
                {categories.map((category) => (
                    <Card key={category.id} className="p-3 bg-muted/30">
                    <div className="flex justify-between items-center mb-2">
                        {category.isEditingName ? (
                        <div className="flex-grow flex items-center gap-2">
                            <Input 
                            type="text" 
                            value={editingCategoryState[category.id]?.name || ''}
                            onChange={(e) => setEditingCategoryState(prev => ({...prev, [category.id]: {...(prev[category.id]), name: e.target.value}}))}
                            className="h-8 text-sm flex-grow"
                            autoFocus
                            />
                        </div>
                        ) : (
                        <h5 className="text-sm font-semibold text-card-foreground truncate flex-grow" title={category.name}>
                           {category.name}
                        </h5>
                        )}
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        {category.isEditingName ? (
                            <>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleSaveCategoryName(category.id)}><CheckCircle size={16}/></Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleCancelEditCategoryName(category.id)}>Cancel</Button>
                            </>
                        ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleEditCategoryName(category.id)} title="Edit category name"><Edit3 size={14}/></Button>
                        )}
                        <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete category"><FolderMinus size={14}/></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Category: {category.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the category and all its feeds.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCategory(category.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>

                    {category.isEditingName && (
                        <div className="mb-3 pl-1">
                            <Label className="text-xs flex items-center mb-1.5">
                                <Palette size={14} className="mr-1.5 text-muted-foreground" /> Category Color
                            </Label>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {predefinedNewsCategoryColors.map(colorOption => (
                                    <button
                                    key={colorOption.value}
                                    type="button"
                                    title={colorOption.name}
                                    className={cn(
                                        "w-5 h-5 rounded-full border-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                                        editingCategoryState[category.id]?.color === colorOption.value ? "border-foreground" : "border-transparent hover:border-muted-foreground/50"
                                    )}
                                    style={{ backgroundColor: colorOption.value }}
                                    onClick={() => handleCategoryColorChange(category.id, colorOption.value)}
                                    />
                                ))}
                                <Input
                                    type="text"
                                    placeholder="#HEX"
                                    value={editingCategoryState[category.id]?.color || ''}
                                    onChange={(e) => handleCategoryColorChange(category.id, e.target.value)}
                                    className={cn(
                                        "h-7 w-20 text-xs",
                                        editingCategoryState[category.id]?.color && !isValidHexColor(editingCategoryState[category.id]?.color) ? "border-destructive focus-visible:ring-destructive" : ""
                                    )}
                                    maxLength={7}
                                />
                            </div>
                        </div>
                    )}
                    
                    <div className="pl-2 border-l-2 border-border/50 space-y-2 mb-2">
                        {category.feeds.map(feed => (
                        <div key={feed.id} className="text-xs p-1.5 rounded bg-background/50">
                            <div className="flex justify-between items-center">
                                <div className="truncate flex-1 min-w-0">
                                    <p className="font-medium truncate" title={feed.userLabel}>{feed.userLabel || "Untitled Feed"}</p>
                                    <p className="text-muted-foreground truncate" title={feed.url}>{feed.url}</p>
                                </div>
                                <div className="flex-shrink-0 ml-2 space-x-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleStartAddOrEditFeed(category.id, feed)} title="Edit feed"><Edit3 size={12}/></Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" title="Delete feed"><Trash2 size={12}/></Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Feed: {feed.userLabel || feed.url}?</AlertDialogTitle>
                                          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteFeed(category.id, feed.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        </div>
                        ))}
                        {category.feeds.length === 0 && <p className="text-xs text-muted-foreground pl-1.5">No feeds in this category.</p>}
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full h-8 text-xs mt-1" 
                        onClick={() => handleStartAddOrEditFeed(category.id)}
                        disabled={editingFeed !== null || category.feeds.length >= MAX_FEEDS_PER_CATEGORY}
                    >
                        <FilePlus size={16} className="mr-1.5" /> Add Feed to "{category.name.substring(0,15)}{category.name.length > 15 ? '...' : ''}" ({category.feeds.length}/{MAX_FEEDS_PER_CATEGORY})
                    </Button>
                    </Card>
                ))}
                {categories.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No categories created yet. Add one above.</p>}
                </div>
            </ScrollArea>
        </CardContent>
    </div>
  );
}
