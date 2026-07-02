-- Add missing DELETE policy for marketing_requests
CREATE POLICY "Anyone can delete marketing requests"
  ON marketing_requests FOR DELETE
  USING (true);