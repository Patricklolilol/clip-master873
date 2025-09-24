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
import { PlayCircle, Edit3, Download, Clock, TrendingUp, Zap, Music, Subtitles, Scissors, AlertCircle } from 'lucide-react';

const Index = () => {
  const [url, setUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [clipCount, setClipCount] = useState([3]);
  const [clipLength, setClipLength] = useState([15, 45]);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [captionsStyle, setCaptionsStyle] = useState('modern');
  const [processingStage, setProcessingStage] = useState('Downloading');
  const [progress, setProgress] = useState(25);

  const mockClips = [
    { id: 1, thumbnail: '', duration: '0:28', score: 0.87, title: 'Epic Reaction Moment', downloads: 0, expiresIn: '23h 45m' },
    { id: 2, thumbnail: '', duration: '0:42', score: 0.79, title: 'Funny Highlight', downloads: 0, expiresIn: '23h 45m' },
    { id: 3, thumbnail: '', duration: '0:35', score: 0.73, title: 'Key Discussion Point', downloads: 0, expiresIn: '23h 45m' },
  ];

  const handleGenerateClips = () => {
    if (!url.trim()) return;
    
    setIsProcessing(true);
    // Simulate processing stages
    const stages = ['Downloading', 'Transcribing', 'Detecting Highlights', 'Creating Clips', 'Uploading'];
    let currentStageIndex = 0;
    let currentProgress = 0;
    
    const interval = setInterval(() => {
      currentProgress += 20;
      setProgress(currentProgress);
      
      if (currentStageIndex < stages.length - 1) {
        setProcessingStage(stages[currentStageIndex]);
        currentStageIndex++;
      }
      
      if (currentProgress >= 100) {
        clearInterval(interval);
        setIsProcessing(false);
        setShowDashboard(true);
      }
    }, 1500);
  };

  if (showDashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <div className="container mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-2">
              Your Viral Clips
            </h1>
            <p className="text-muted-foreground">AI-generated clips from your video content</p>
          </div>

          <Tabs defaultValue="clips" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="clips">Clips</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            
            <TabsContent value="clips" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockClips.map((clip) => (
                  <Card key={clip.id} className="overflow-hidden hover:shadow-card transition-all duration-300 border-0 bg-card/50 backdrop-blur">
                    <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 relative flex items-center justify-center">
                      <PlayCircle className="w-12 h-12 text-primary" />
                      <Badge variant="secondary" className="absolute top-2 right-2">{clip.duration}</Badge>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold truncate">{clip.title}</h3>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4 text-accent" />
                          <span className="text-sm font-medium text-accent">{Math.round(clip.score * 100)}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>Expires in {clip.expiresIn}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Edit3 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button size="sm" variant="default" className="flex-1">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              
              <Card className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-0">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Backend Integration Required</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      To generate real clips with video processing, authentication, and storage, connect to Supabase.
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Performance Analytics</h3>
                <p className="text-muted-foreground">Real YouTube metrics will appear here once Supabase integration is active.</p>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Job Activity & Logs</h3>
                <p className="text-muted-foreground">Processing history and detailed logs will appear here.</p>
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
                <span>Current Stage: {processingStage}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
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