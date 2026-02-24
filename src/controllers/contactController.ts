import { Request, Response } from 'express';
import ContactMessage from '../models/ContactMessage';

// @desc    Submit contact form
// @route   POST /api/contact
// @access  Public
export const submitContact = async (req: Request, res: Response) => {
  try {
    const { name, email, message } = req.body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      res.status(400).json({ message: 'Name, email and message are required' });
      return;
    }

    const contact = await ContactMessage.create({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    });

    res.status(201).json({ message: 'Thank you for your message. We will get back to you soon.', id: contact._id });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
