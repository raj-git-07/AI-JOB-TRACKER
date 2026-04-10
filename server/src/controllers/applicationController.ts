import { Request, Response } from "express";
import Application from "../models/Application";

interface AuthRequest extends Request {
  user?: any;
}

export const createApplication = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { company, role, jdLink, notes, dateApplied, followUpDate, status, salary } = req.body;

    if (!company || !role) {
      res.status(400).json({ message: "Company and role are required" });
      return;
    }

    const application = await Application.create({
      user: req.user.id,
      company,
      role,
      jdLink,
      notes,
      dateApplied,
      followUpDate: followUpDate || undefined,
      status,
      salary,
    });

    res.status(201).json({
      message: "Application created successfully",
      application,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

export const getApplications = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const applications = await Application.find({ user: req.user.id }).sort({
      createdAt: -1,
    });

    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

export const updateApplication = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    if (application.user.toString() !== req.user.id) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    const { company, role, jdLink, notes, dateApplied, followUpDate, status, salary } = req.body;

    application.company = company ?? application.company;
    application.role = role ?? application.role;
    application.jdLink = jdLink ?? application.jdLink;
    application.notes = notes ?? application.notes;
    application.dateApplied = dateApplied ?? application.dateApplied;
    application.followUpDate = followUpDate ?? application.followUpDate;
    application.status = status ?? application.status;
    application.salary = salary ?? application.salary;

    const updatedApplication = await application.save();

    res.status(200).json({
      message: "Application updated successfully",
      application: updatedApplication,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

export const deleteApplication = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    if (application.user.toString() !== req.user.id) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    await application.deleteOne();

    res.status(200).json({
      message: "Application deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};