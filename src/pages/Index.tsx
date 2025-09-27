import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlayCircle, Edit3, Download, Clock, TrendingUp, Zap, Music, Subtitles, Scissors, AlertCircle, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useJobManagement } from '@/hooks/useJobManagement';

const Index = () => {
  const { user, signOut } = useAuth();
  const { jobs, clips, isLoading: jobLoading, createJob } = useJobManagement();
  
  const [url, setUrl] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);
  const [forceInputView, setForceInputView] = useState(false);
  const [clipCount, setClipCount] = useState([3]);
  const [clipLength, setClipLength] = useState([15, 45]);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [captionsStyle, setCaptionsStyle] = useState('modern');

  // Get the most recent processing job
  const currentJob = jobs.find(job => ['queued', 'downloading', 'transcribing', 'detecting_highlights', 'creating_clips', 'uploading'].includes(job.status));
  const isProcessing = !!currentJob;

  const handleGenerateClips = async () => {
    if (!url.trim()) return;
    
    const jobData = {
      youtube_url: url,
      max_clips: clipCount[0],
      min_duration: clipLength[0],
      max_duration: clipLength[1],
      captions_style: captionsStyle as 'modern' | 'bold' | 'neon' | 'classic',
      music_enabled: musicEnabled,
      sfx_enabled: sfxEnabled
    };

    const result = await createJob(jobData);
    if (result) {
      setShowDashboard(true);
      setForceInputView(false);
    }
  };

  const handleNewVideo = () => {
    setUrl('');
    setShowDashboard(false);
    setForceInputView(true);
    // Focus the input field after state update
    setTimeout(() => {
      const urlInput = document.getElementById('video-url');
      if (urlInput) {
        urlInput.focus();
      }
    }, 100);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Show clips dashboard logic - forceInputView takes precedence
  const shouldShowDashboard = !forceInputView && (showDashboard || clips.length > 0 || isProcessing);

  if (shouldShowDashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <div className="container mx-auto p-6">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-2">
                Your Viral Clips
              </h1>
              <p className="text-muted-foreground">AI-generated clips from your video content</p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleNewVideo}
                className="hidden md:flex"
              >
                New Video
              </Button>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="text-sm">{user?.email}</span>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <Tabs defaultValue="clips" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="clips">Clips</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            
            <TabsContent value="clips" className="space-y-6">
              {clips.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {clips.map((clip) => {
                    const expiresAt = new Date(clip.expires_at);
                    const now = new Date();
                    const timeLeft = Math.max(0, expiresAt.getTime() - now.getTime());
                    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    
                    return (
                      <Card key={clip.id} className="overflow-hidden hover:shadow-card transition-all duration-300 border-0 bg-card/50 backdrop-blur">
                        <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 relative overflow-hidden rounded-t-lg">
                          {clip.video_url ? (
                            <video 
                              src={clip.video_url} 
                              poster={clip.thumbnail_urls?.[0]} 
                              className="w-full h-full object-cover"
                              controls
                              preload="metadata"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <PlayCircle className="w-12 h-12 text-primary" />
                            </div>
                          )}
                          <Badge variant="secondary" className="absolute top-2 right-2">
                            {Math.floor(clip.duration_seconds / 60)}:{String(Math.floor(clip.duration_seconds % 60)).padStart(2, '0')}
                          </Badge>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold truncate">{clip.title}</h3>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-4 h-4 text-accent" />
                              <span className="text-sm font-medium text-accent">
                                {Math.round((clip.predicted_engagement || 0) * 100)}%
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>Expires in {hoursLeft}h {minutesLeft}m</span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1">
                              <Edit3 className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            {clip.video_url ? (
                              <Button size="sm" variant="default" className="flex-1" asChild>
                                <a href={clip.video_url} download={`${clip.title}.mp4`}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download
                                </a>
                              </Button>
                            ) : (
                              <Button size="sm" variant="default" className="flex-1" disabled>
                                <Download className="w-4 h-4 mr-2" />
                                Processing...
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No clips yet</h3>
                  <p className="text-muted-foreground mb-4">
                    {isProcessing 
                      ? "Your video is being processed. Clips will appear here when ready."
                      : "Create your first viral clip by processing a YouTube video."}
                  </p>
                  {!isProcessing && (
                    <Button onClick={handleNewVideo}>
                      Process New Video
                    </Button>
                  )}
                </Card>
              )}
              
              <Card className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-0">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Real Video Processing Active</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      This system processes real YouTube videos using AI to create downloadable clips. 
                      All features are fully operational.
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Performance Analytics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{jobs.length}</div>
                    <div className="text-sm text-muted-foreground">Total Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-secondary">{clips.length}</div>
                    <div className="text-sm text-muted-foreground">Clips Generated</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent">
                      {clips.reduce((sum, clip) => sum + clip.download_count, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Downloads</div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  {jobs.slice(0, 10).map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <div className="font-medium">{job.title || 'Processing Video'}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(job.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge 
                        variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}
                      >
                        {job.status}
                      </Badge>
                    </div>
                  ))}
                  {jobs.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">No activity yet</p>
                  )}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-5" />
        <div className="container mx-auto px-6 py-24 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <Badge variant="secondary" className="mb-4">
                <Zap className="w-4 h-4 mr-2" />
                AI-Powered Clip Generation
              </Badge>
              <h1 className="text-5xl md:text-7xl font-bold">
                <span className="bg-gradient-hero bg-clip-text text-transparent">
                  Viral Clips
                </span>
                <br />
                Made Easy
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Transform your YouTube videos into viral-ready clips with AI-powered highlight detection, 
                automatic captions, and professional editing tools.
              </p>
            </div>

            {/* URL Input Section */}
            <Card className="max-w-2xl mx-auto p-8 bg-card/80 backdrop-blur border-0 shadow-card">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="video-url" className="text-base font-medium">YouTube Video URL</Label>
                  <div className="flex gap-3">
                    <Input
                      id="video-url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="flex-1 h-12 text-base"
                    />
                    <Button 
                      onClick={handleGenerateClips}
                      disabled={!url.trim()}
                      className="h-12 px-8 bg-gradient-primary hover:shadow-glow transition-all duration-300"
                    >
                      Generate Clips
                    </Button>
                  </div>
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">Clip Count: {clipCount[0]}</Label>
                    <Slider
                      value={clipCount}
                      onValueChange={setClipCount}
                      max={6}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">Length: {clipLength[0]}s - {clipLength[1]}s</Label>
                    <Slider
                      value={clipLength}
                      onValueChange={setClipLength}
                      max={60}
                      min={15}
                      step={5}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4" />
                      <Label htmlFor="music-toggle" className="text-sm">Add Background Music</Label>
                    </div>
                    <Switch
                      id="music-toggle"
                      checked={musicEnabled}
                      onCheckedChange={setMusicEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Subtitles className="w-4 h-4" />
                      <Label htmlFor="sfx-toggle" className="text-sm">Add Sound Effects</Label>
                    </div>
                    <Switch
                      id="sfx-toggle"
                      checked={sfxEnabled}
                      onCheckedChange={setSfxEnabled}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium mb-3 block">Caption Style</Label>
                    <Select value={captionsStyle} onValueChange={setCaptionsStyle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="modern">Modern (Clean & Minimal)</SelectItem>
                        <SelectItem value="bold">Bold (High Contrast)</SelectItem>
                        <SelectItem value="neon">Neon (Glowing Effect)</SelectItem>
                        <SelectItem value="classic">Classic (Traditional)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Copyright Notice */}
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-sm text-foreground">
                    <strong>Copyright Notice:</strong> We'll replace copyrighted music unless you confirm you have rights. 
                    All generated clips use royalty-free audio by default.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="p-6 text-center bg-card/50 backdrop-blur border-0 hover:shadow-card transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mx-auto mb-4">
              <Scissors className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold mb-2">AI Highlight Detection</h3>
            <p className="text-sm text-muted-foreground">
              Advanced algorithms analyze audio, visual cues, and engagement patterns to find the best moments.
            </p>
          </Card>

          <Card className="p-6 text-center bg-card/50 backdrop-blur border-0 hover:shadow-card transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
              <Subtitles className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold mb-2">Auto Captions & Effects</h3>
            <p className="text-sm text-muted-foreground">
              Professional captions, background music, and sound effects added automatically.
            </p>
          </Card>

          <Card className="p-6 text-center bg-card/50 backdrop-blur border-0 hover:shadow-card transition-all duration-300">
            <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold mb-2">Performance Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Real metrics from YouTube help improve future clip selection and optimization.
            </p>
          </Card>
        </div>
      </section>

      {/* Processing Modal */}
      <Dialog open={isProcessing} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generating Your Clips</DialogTitle>
            <DialogDescription>
              Please wait while we process your video and create viral-ready clips.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Current Stage: {currentJob?.current_stage || 'Processing'}</span>
                <span>{currentJob?.progress_percent || 0}%</span>
              </div>
              <Progress value={currentJob?.progress_percent || 0} className="w-full" />
            </div>
            <div className="text-sm text-muted-foreground">
              Processing stages: Download → Transcribe → Detect Highlights → Create Clips → Upload
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;