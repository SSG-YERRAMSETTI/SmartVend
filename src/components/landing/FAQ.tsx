import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function FAQ() {
  const faqs = [
    {
      question: "How long does it take to get started?",
      answer: "Most operators are up and running within 30 minutes. Simply sign up, add your machines and locations, and you're ready to go. We provide CSV import templates for bulk uploads.",
    },
    {
      question: "Do I need special hardware for telemetry?",
      answer: "SmartVend integrates with major telemetry providers like Cantaloupe, Nayax, and USA Technologies. If you don't have telemetry hardware, you can still use all features with manual input via our mobile app.",
    },
    {
      question: "Can I try before committing?",
      answer: "Absolutely! We offer a 14-day free trial with full access to all features. No credit card required. You can cancel anytime during or after the trial.",
    },
    {
      question: "How does pricing scale with more machines?",
      answer: "Our pricing is per-machine tier. As you grow, we offer volume discounts. Contact our sales team for custom enterprise pricing if you have 50+ machines.",
    },
    {
      question: "Is my data secure?",
      answer: "Yes. We use bank-level encryption, secure data centers, and regular security audits. Your data is backed up daily and we're SOC 2 compliant.",
    },
    {
      question: "Can drivers use this offline?",
      answer: "Yes! Our mobile app works offline and syncs automatically when back online. Drivers can complete stops, record cash, and update inventory without internet.",
    },
    {
      question: "Do you offer training and support?",
      answer: "All plans include email support and video tutorials. Professional and Enterprise plans get priority support and dedicated onboarding. Enterprise plans include personalized training sessions.",
    },
    {
      question: "Can I export my data?",
      answer: "Yes. You can export all your data in CSV, JSON, or Excel formats at any time. Your data always remains yours.",
    },
  ];

  return (
    <section className="py-24 bg-background" id="faq">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about SmartVend
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-lg font-medium">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            Still have questions? <span className="text-primary font-medium cursor-pointer hover:underline">Contact our team</span>
          </p>
        </div>
      </div>
    </section>
  );
}
