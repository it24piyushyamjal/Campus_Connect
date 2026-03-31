import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

export default function ClassSelection() {
  const { availableClasses, selectClass, user } = useAuth();
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedClass || isSubmitting) return;

    setIsSubmitting(true);
    const { error } = await selectClass(selectedClass);

    if (error) {
      toast.error(error.message || 'Failed to save class selection');
      setIsSubmitting(false);
      return;
    }

    toast.success('Class selected successfully');
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Select Your Class</CardTitle>
          <p className="text-muted-foreground">
            Welcome {user?.name}! Please select your class to continue.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={selectedClass}
            onValueChange={setSelectedClass}
            className="grid grid-cols-2 gap-4"
          >
            {availableClasses.map((className) => (
              <div key={className} className="flex items-center space-x-2">
                <RadioGroupItem value={className} id={className} />
                <Label 
                  htmlFor={className}
                  className="cursor-pointer flex-1 text-center p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  {className}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <Button
            onClick={handleSubmit}
            disabled={!selectedClass || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Continuing...' : 'Continue to Dashboard'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}