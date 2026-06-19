-- Create message_templates table
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read templates
CREATE POLICY "Authenticated users can view templates"
  ON message_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert templates
CREATE POLICY "Authenticated users can create templates"
  ON message_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update templates
CREATE POLICY "Authenticated users can update templates"
  ON message_templates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete templates
CREATE POLICY "Authenticated users can delete templates"
  ON message_templates
  FOR DELETE
  TO authenticated
  USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default templates
INSERT INTO message_templates (title, category, subject, body) VALUES
(
  'Accept Client - 1st Meeting',
  '1st Meeting - Accept',
  'Re: Meeting Request - {{company_name}}',
  'Hi {{contact_name}},

Thank you for reaching out to Exodia. We''d love to schedule an initial meeting to discuss your project requirements and how our team can help.

Are you available for a call on {{proposed_date}}? Let us know what time works best for you.

Looking forward to connecting.

Best regards,
{{sender_name}}
Exodia Game Development'
),
(
  'Decline Client - 1st Meeting',
  '1st Meeting - Decline',
  'Re: Meeting Request - {{company_name}}',
  'Hi {{contact_name}},

Thank you for your interest in Exodia Game Development. After reviewing your requirements, we regret to inform you that this project doesn''t align with our current capacity and expertise.

We appreciate you considering us and wish you the best with your project.

Best regards,
{{sender_name}}
Exodia Game Development'
),
(
  'Handoff to Sales - 2nd Meeting',
  '2nd Meeting - Handoff to Sales',
  'Next Steps - {{company_name}} Project Discussion',
  'Hi {{contact_name}},

Great speaking with you about your project. Based on our discussion, I''d like to introduce you to {{sales_rep_name}} from our Sales team who will help take things forward.

They''ll reach out shortly to discuss pricing, timelines, and next steps. Feel free to reply to this email if you have any immediate questions.

Best regards,
{{sender_name}}
Exodia Game Development'
),
(
  'Handoff to Operations - 2nd Meeting',
  '2nd Meeting - Handoff to Operations',
  'Project Onboarding - {{company_name}}',
  'Hi {{contact_name}},

Following our second meeting, I''m handing you over to our Operations team to begin the onboarding process.

{{ops_rep_name}} will be your main point of contact going forward. They''ll set up the project workspace, share the development timeline, and schedule the kickoff meeting.

Looking forward to working together.

Best regards,
{{sender_name}}
Exodia Game Development'
),
(
  'Quotation Sent',
  'Quotation - Sent',
  'Project Quotation - {{company_name}}',
  'Hi {{contact_name}},

Please find attached our quotation for the {{project_name}} project.

The proposal includes:
- Scope of work
- Timeline and milestones
- Pricing breakdown

Please review and let us know if you have any questions. We''re happy to hop on a call to walk through the details.

Best regards,
{{sender_name}}
Exodia Game Development'
);
