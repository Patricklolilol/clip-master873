import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Download, Play, Edit3, Music, Volume2, Type, Palette } from 'lucide-react';

interface Clip {
  id: string;
  title: string;
  duration_seconds: number;
  start_time: number;
  end_time: number;
  predicted_engagement: number;
  video_url?: string;
  thumbnail_urls: string[];
  subtitle_urls: string[];
  status: string;
  segment_scores: any;
  expires_at: string;
}

interface ClipEditorProps {
  clip: Clip;
  onClipUpdate: (updatedClip: Clip) => void;
}

export const ClipEditor: React.FC<ClipEditorProps> = ({ clip, onClipUpdate }) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [editSettings, setEditSettings] = useState({
    captions_style: 'modern' as 'modern' | 'bold' | 'neon' | 'classic',
    music_enabled: true,
    sfx_enabled: true,
    custom_captions: '',
    music_track: 'upbeat',
    sfx_effects: ['transition']
  });

  const processingMetadata = clip.segment_scores?.processing_metadata || {};
  const timeRemaining = Math.max(0, new Date(clip.expires_at).getTime() - Date.now());
  const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

  const handleProcessClip = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-clips', {
        body: {
          clip_id: clip.id,
          edits: editSettings
        }
      });

      if (error) throw error;

      toast({
        title: "Clip Processed!",
        description: "Your edited clip is ready for download.",
      });

      // Update clip with new data
      const updatedClip = { ...clip, ...data };
      onClipUpdate(updatedClip);

    } catch (error: any) {
      console.error('Error processing clip:', error);
      toast({
        title: "Processing Failed",
        description: error.message || "There was an error processing your clip.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Clip Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              {clip.title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={clip.status === 'ready' ? 'default' : 'secondary'}>
                {clip.status}
              </Badge>
              <Badge variant="outline">
                {formatTime(clip.start_time)} - {formatTime(clip.end_time)}
              </Badge>
              <Badge variant="destructive">
                Expires: {hoursRemaining}h {minutesRemaining}m
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Video Preview */}
            <div className="space-y-4">
              <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                {clip.video_url ? (
                  <video 
                    src={clip.video_url} 
                    controls 
                    className="w-full h-full rounded-lg"
                    poster={clip.thumbnail_urls[0]}
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    <Play className="h-12 w-12 mx-auto mb-2" />
                    <p>Processing...</p>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  onClick={handleProcessClip} 
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? 'Processing...' : 'Apply Edits'}
                </Button>
                {clip.video_url && (
                  <Button variant="outline" asChild>
                    <a href={clip.video_url} download>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Clip Stats */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="text-xl font-bold">{clip.duration_seconds.toFixed(1)}s</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Predicted Engagement</p>
                  <p className="text-xl font-bold">{(clip.predicted_engagement * 100).toFixed(1)}%</p>
                </div>
              </div>
              
              {processingMetadata.caption_suggestions && (
                <div className="space-y-2">
                  <h4 className="font-semibold">AI Suggestions</h4>
                  <div className="space-y-1">
                    <p className="text-sm"><strong>Style:</strong> {processingMetadata.style}</p>
                    <p className="text-sm"><strong>Music:</strong> {processingMetadata.music_suggestion}</p>
                    <p className="text-sm"><strong>SFX:</strong> {processingMetadata.sfx_suggestion}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editing Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Customize Your Clip</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="captions" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="captions" className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                Captions
              </TabsTrigger>
              <TabsTrigger value="music" className="flex items-center gap-2">
                <Music className="h-4 w-4" />
                Music
              </TabsTrigger>
              <TabsTrigger value="effects" className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Effects
              </TabsTrigger>
            </TabsList>

            <TabsContent value="captions" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="caption-style">Caption Style</Label>
                  <Select 
                    value={editSettings.captions_style} 
                    onValueChange={(value: any) => setEditSettings(prev => ({...prev, captions_style: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">Modern - Clean white text</SelectItem>
                      <SelectItem value="bold">Bold - Thick text with shadow</SelectItem>
                      <SelectItem value="neon">Neon - Colorful glowing text</SelectItem>
                      <SelectItem value="classic">Classic - Simple black text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="custom-captions">Custom Caption Text</Label>
                  <Textarea
                    id="custom-captions"
                    placeholder="Override AI-generated captions..."
                    value={editSettings.custom_captions}
                    onChange={(e) => setEditSettings(prev => ({...prev, custom_captions: e.target.value}))}
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="music" className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="music-enabled"
                  checked={editSettings.music_enabled}
                  onCheckedChange={(checked) => setEditSettings(prev => ({...prev, music_enabled: checked}))}
                />
                <Label htmlFor="music-enabled">Enable Background Music</Label>
              </div>
              
              {editSettings.music_enabled && (
                <div>
                  <Label htmlFor="music-track">Music Track</Label>
                  <Select 
                    value={editSettings.music_track} 
                    onValueChange={(value) => setEditSettings(prev => ({...prev, music_track: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select music" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upbeat">Upbeat - Energetic track</SelectItem>
                      <SelectItem value="chill">Chill - Relaxed background</SelectItem>
                      <SelectItem value="dramatic">Dramatic - Tension building</SelectItem>
                      <SelectItem value="funny">Funny - Comedy background</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </TabsContent>

            <TabsContent value="effects" className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="sfx-enabled"
                  checked={editSettings.sfx_enabled}
                  onCheckedChange={(checked) => setEditSettings(prev => ({...prev, sfx_enabled: checked}))}
                />
                <Label htmlFor="sfx-enabled">Enable Sound Effects</Label>
              </div>
              
              {editSettings.sfx_enabled && (
                <div className="space-y-2">
                  <Label>Sound Effects</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Whoosh', 'Pop', 'Ding', 'Boom', 'Zap', 'Swoosh'].map((effect) => (
                      <div key={effect} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`sfx-${effect}`}
                          checked={editSettings.sfx_effects.includes(effect.toLowerCase())}
                          onChange={(e) => {
                            const effectLower = effect.toLowerCase();
                            setEditSettings(prev => ({
                              ...prev,
                              sfx_effects: e.target.checked 
                                ? [...prev.sfx_effects, effectLower]
                                : prev.sfx_effects.filter(sfx => sfx !== effectLower)
                            }));
                          }}
                        />
                        <Label htmlFor={`sfx-${effect}`}>{effect}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};