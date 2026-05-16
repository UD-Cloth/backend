import { Request, Response } from 'express';
import ContactMessage from '../models/ContactMessage';

// Sprint 5 / BUG-B-024 + BUG-B-026: validate length and format on contact form.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 100;
const MAX_EMAIL = 200;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;

// @desc    Submit contact form
// @route   POST /api/contact
// @access  Public
export const submitContact = async (req: Request, res: Response) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';

    if (!name || !email || !message) {
      res.status(400).json({ message: 'Name, email and message are required' });
      return;
    }
    if (name.length > MAX_NAME) {
      res.status(400).json({ message: `Name must be ${MAX_NAME} characters or less` });
      return;
    }
    if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
      res.status(400).json({ message: 'Please provide a valid email address' });
      return;
    }
    if (subject.length > MAX_SUBJECT) {
      res.status(400).json({ message: `Subject must be ${MAX_SUBJECT} characters or less` });
      return;
    }
    if (message.length > MAX_MESSAGE) {
      res.status(400).json({ message: `Message must be ${MAX_MESSAGE} characters or less` });
      return;
    }

    const contact = await ContactMessage.create({
      name,
      email: email.toLowerCase(),
      subject: subject || undefined,
      message,
    });

    res.status(201).json({
      message: 'Thank you for your message. We will get back to you soon.',
      id: contact._id,
    });
  } catch (error: any) {
    if (error?.name === 'ValidationError') {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Server Error' });
  }
};
