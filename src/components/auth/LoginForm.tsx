import { useState } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GraduationCap, Users, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const { login, signup } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignup) {
        const { error } = await signup(email, password, name, role);
        if (error) {
          toast.error(error.message || 'Failed to create account');
        } else {
          toast.success('Account created successfully! Please verify your email, then sign in.');
          return;
        }
      } else {
        const { error } = await login(email, password);
        if (error) {
          toast.error(error.message || 'Invalid credentials');
        } else {
          toast.success(`Welcome back!`);
          return;
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    }
    
    setIsLoading(false);
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center text-white">
          <div className="flex items-center justify-center mb-4">
            <GraduationCap className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-bold">CampusConnect</h1>
          <p className="text-white/80 mt-2">Your Educational Hub</p>
        </div>

        {/* Auth Card */}
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center">
            <CardTitle>{isSignup ? 'Create Account' : 'Welcome Back'}</CardTitle>
            <CardDescription>
              {isSignup ? 'Sign up to access your campus resources' : 'Sign in to access your campus resources'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role Selection */}
              {isSignup && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Select your role</Label>
                  <RadioGroup
                    value={role}
                    onValueChange={(value) => setRole(value as UserRole)}
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2 flex-1">
                      <RadioGroupItem value="student" id="student" />
                      <Label htmlFor="student" className="flex items-center space-x-2 cursor-pointer">
                        <BookOpen className="h-4 w-4" />
                        <span>Student</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 flex-1">
                      <RadioGroupItem value="faculty" id="faculty" />
                      <Label htmlFor="faculty" className="flex items-center space-x-2 cursor-pointer">
                        <Users className="h-4 w-4" />
                        <span>Faculty</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Name - only for signup */}
              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (isSignup ? 'Creating Account...' : 'Signing in...') : (isSignup ? 'Create Account' : 'Sign In')}
              </Button>
            </form>

            {/* Demo Accounts */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground text-center mb-3">
                Demo Accounts (Click to auto-fill)
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={() => {
                    setEmail('student1@campus.edu');
                    setPassword('demo');
                    setIsSignup(false);
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Devang Keloth</div>
                      <div className="text-xs text-muted-foreground">
                        student1@campus.edu • student
                      </div>
                    </div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={() => {
                    setEmail('faculty1@campus.edu');
                    setPassword('demo');
                    setIsSignup(false);
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Dr. Priya Sharma</div>
                      <div className="text-xs text-muted-foreground">
                        faculty1@campus.edu • faculty
                      </div>
                    </div>
                  </div>
                </Button>
              </div>
            </div>

            {/* Toggle between login/signup */}
            <div className="mt-4 text-center">
              <Button
                variant="link"
                onClick={() => setIsSignup(!isSignup)}
                className="text-sm"
              >
                {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}