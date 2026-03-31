import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, MessageCircle, User, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Reply {
  id: number;
  author: string;
  role: string;
  content: string;
  timestamp: string;
}

interface Question {
  id: number;
  title: string;
  content: string;
  subject: string;
  author: string;
  role: string;
  timestamp: string;
  replies: Reply[];
  resolved: boolean;
}

const initialQuestions: Question[] = [
  {
    id: 1,
    title: "Help with Calculus Integration",
    content: "I'm struggling with integration by parts. Can someone explain the step-by-step process?",
    subject: "Mathematics",
    author: "Sneha Gupta",
    role: "student",
    timestamp: "2024-01-15T10:30:00Z",
    resolved: false,
    replies: [
      {
        id: 1,
        author: "Dr. Prakash Raj",
        role: "faculty",
        content: "Integration by parts uses the formula: ∫u dv = uv - ∫v du. First, identify u and dv, then apply the formula.",
        timestamp: "2024-01-15T11:00:00Z"
      }
    ]
  },
  {
    id: 2,
    title: "Quantum Physics - Wave-Particle Duality",
    content: "Can someone explain how light can behave as both a wave and a particle?",
    subject: "Physics",
    author: "Devang Keloth",
    role: "student",
    timestamp: "2024-01-14T15:20:00Z",
    resolved: true,
    replies: [
      {
        id: 2,
        author: "Prof. Arjun Menon",
        role: "faculty",
        content: "This is explained by quantum mechanics. Light exhibits wave properties (interference, diffraction) and particle properties (photoelectric effect). The behavior depends on the experimental setup.",
        timestamp: "2024-01-14T16:00:00Z"
      }
    ]
  },
  {
    id: 3,
    title: "Organic Chemistry Reaction Mechanisms",
    content: "What's the mechanism for nucleophilic substitution in alkyl halides?",
    subject: "Chemistry",
    author: "Kavya Nair",
    role: "student",
    timestamp: "2024-01-13T09:15:00Z",
    resolved: false,
    replies: []
  }
];

export default function DoubtForum() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    title: "",
    content: "",
    subject: "Mathematics"
  });
  const [replyContent, setReplyContent] = useState<{ [key: number]: string }>({});

  const subjects = ["All", "Mathematics", "Physics", "Chemistry", "Computer Science", "English", "Biology"];

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         q.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === "All" || q.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  const handleSubmitQuestion = () => {
    if (!newQuestion.title.trim() || !newQuestion.content.trim()) return;

    const question: Question = {
      id: Date.now(),
      title: newQuestion.title,
      content: newQuestion.content,
      subject: newQuestion.subject,
      author: user?.name || "Anonymous",
      role: user?.role || "student",
      timestamp: new Date().toISOString(),
      replies: [],
      resolved: false
    };

    setQuestions([question, ...questions]);
    setNewQuestion({ title: "", content: "", subject: "Mathematics" });
    setShowNewQuestion(false);
  };

  const handleSubmitReply = (questionId: number) => {
    const content = replyContent[questionId];
    if (!content?.trim()) return;

    const reply: Reply = {
      id: Date.now(),
      author: user?.name || "Anonymous",
      role: user?.role || "student",
      content,
      timestamp: new Date().toISOString()
    };

    setQuestions(questions.map(q => 
      q.id === questionId 
        ? { ...q, replies: [...q.replies, reply] }
        : q
    ));

    setReplyContent({ ...replyContent, [questionId]: "" });
  };

  const toggleResolved = (questionId: number) => {
    setQuestions(questions.map(q => 
      q.id === questionId 
        ? { ...q, resolved: !q.resolved }
        : q
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Doubt Forum</h1>
          <p className="text-muted-foreground">Ask questions and help your peers</p>
        </div>
        <Button onClick={() => setShowNewQuestion(true)}>
          Ask Question
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="px-3 py-2 border border-input bg-background rounded-md"
        >
          {subjects.map(subject => (
            <option key={subject} value={subject}>{subject}</option>
          ))}
        </select>
      </div>

      {/* New Question Form */}
      {showNewQuestion && (
        <Card>
          <CardHeader>
            <CardTitle>Ask a Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Question title..."
              value={newQuestion.title}
              onChange={(e) => setNewQuestion({ ...newQuestion, title: e.target.value })}
            />
            <select
              value={newQuestion.subject}
              onChange={(e) => setNewQuestion({ ...newQuestion, subject: e.target.value })}
              className="px-3 py-2 border border-input bg-background rounded-md w-full"
            >
              {subjects.slice(1).map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
            <Textarea
              placeholder="Describe your question in detail..."
              value={newQuestion.content}
              onChange={(e) => setNewQuestion({ ...newQuestion, content: e.target.value })}
              rows={4}
            />
            <div className="flex gap-2">
              <Button onClick={handleSubmitQuestion}>Submit Question</Button>
              <Button variant="outline" onClick={() => setShowNewQuestion(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.map((question) => (
          <Card key={question.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{question.subject}</Badge>
                    {question.resolved && (
                      <Badge variant="default">Resolved</Badge>
                    )}
                    {user?.role === 'faculty' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleResolved(question.id)}
                      >
                        {question.resolved ? 'Mark Unresolved' : 'Mark Resolved'}
                      </Button>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold">{question.title}</h3>
                  <p className="text-muted-foreground mt-2">{question.content}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {question.author} ({question.role})
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(question.timestamp).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  {question.replies.length} replies
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Replies */}
              {question.replies.length > 0 && (
                <div className="space-y-3 mb-4">
                  {question.replies.map((reply) => (
                    <div key={reply.id} className="border-l-2 border-muted pl-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {reply.author.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{reply.author}</span>
                        <Badge variant="secondary" className="text-xs">
                          {reply.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(reply.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm">{reply.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Form */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Write your reply..."
                  value={replyContent[question.id] || ""}
                  onChange={(e) => setReplyContent({
                    ...replyContent,
                    [question.id]: e.target.value
                  })}
                  rows={2}
                  className="flex-1"
                />
                <Button
                  onClick={() => handleSubmitReply(question.id)}
                  disabled={!replyContent[question.id]?.trim()}
                >
                  Reply
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredQuestions.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No questions found matching your search.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}