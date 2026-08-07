import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export function ContactTrial() {
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Thanks! We'll be in touch soon.");
  };

  return (
    <section className="py-24 bg-muted/30" id="contact">
      <div className="container mx- center px-6">
        <div className="grid lg:grid-cols-2 gap-12 max- justify center mx-center">
          {/* CTA Side */}
          {/* <div>
            <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join hundreds of vending operators who've streamlined their operations with SmartVend.
            </p>

            <Card className="bg-gradient-hero text-primary-foreground mb-8">
              <CardContent className="pt-8 pb-8">
                <h3 className="text-2xl font-bold mb-4">Start Your Free Trial</h3>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary-foreground"></div>
                    <span>Full access to all features</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary-foreground"></div>
                    <span>14 days completely free</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary-foreground"></div>
                    <span>No credit card required</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary-foreground"></div>
                    <span>Cancel anytime</span>
                  </li>
                </ul>
                <Button 
                  size="lg" 
                  variant="secondary" 
                  className="w-full h-14 text-lg"
                  onClick={() => navigate("/signup")}
                >
                  Start Free Trial →
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Email us</p>
                  <p className="text-sm text-muted-foreground">support@smartvend.com</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Call us</p>
                  <p className="text-sm text-muted-foreground">1-800-SMARTVEND</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Live chat</p>
                  <p className="text-sm text-muted-foreground">Available Mon-Fri, 9am-6pm EST</p> */}
                </div>
              </div>
            {/* </div>
          </div> */}

          {/* Contact Form Side */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-2xl font-bold mb-6">Get in Touch</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    placeholder="John Smith" 
                    required 
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="john@example.com" 
                    required 
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company Name</Label>
                  <Input 
                    id="company" 
                    placeholder="ABC Vending Co." 
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="machines">Number of Machines</Label>
                  <Input 
                    id="machines" 
                    type="number" 
                    placeholder="25" 
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us about your needs..."
                    rows={4}
                    className="resize-none"
                  />
                </div>

                
                  <Button type="submit" className="w-full h-12 mt-2 flex justify-center items-center"> 
                    Send Message 
                  </Button>
                


                <p className="text-xs text-muted-foreground text-center">
                  We'll respond within 1 business day
                </p>
              </form>
            </CardContent>
          </Card>
        {/* </div> */}
      {/* </div> */}
    </section>
  );
}
