import { Request, Response } from 'express';
import { Review, Mechanic } from '../models';
import { logger } from '../lib/logger';
import { Op } from 'sequelize';

const recalculateMechanicRating = async (mechanicId: number) => {
  const reviews = await Review.findAll({
    where: { mechanicId, status: 'Approved' }
  });

  if (reviews.length === 0) {
    await Mechanic.update({ rating: 0 }, { where: { id: mechanicId } });
    return;
  }

  let totalScore = 0;
  for (const review of reviews) {
    const avgForReview = (review.ratingTimeliness + review.ratingFairness + review.ratingRecommendation) / 3;
    totalScore += avgForReview;
  }
  
  const overallRating = Number((totalScore / reviews.length).toFixed(1));
  await Mechanic.update({ rating: overallRating }, { where: { id: mechanicId } });
};

export const submitReview = async (req: Request, res: Response) => {
  try {
    const mechanicId = req.params.id;
    const { 
      name, email, visitorId, fingerprint, 
      ratingTimeliness, ratingFairness, ratingRecommendation, 
      isProblemFixed, comments 
    } = req.body;

    const mechanic = await Mechanic.findByPk(Number(mechanicId));
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic not found' });
    }

    // Removed duplicate review check to allow multiple reviews from the same user

    const review = await Review.create({
      mechanicId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      visitorId,
      fingerprint,
      ratingTimeliness,
      ratingFairness,
      ratingRecommendation,
      isProblemFixed,
      comments: comments ? comments.trim() : null,
      status: 'Pending' // We can set this to pending and allow admin to approve, or auto-approve
    });

    // Optionally auto-approve or keep pending. User said "admin panel ... moderate/delete". 
    // Usually we auto-approve so users see their reviews. Let's set it to Pending by default if they want moderation, 
    // or just 'Approved' to be visible immediately. I will set to Approved for immediate feedback, or Pending if moderation is strict.
    // I will auto-approve for now so it shows up, then Admin can delete/reject it.
    await review.update({ status: 'Approved' });
    await recalculateMechanicRating(Number(mechanicId));

    res.status(201).json({ message: 'Review submitted successfully', review });
  } catch (error) {
    logger.error('submit_review_failed', { error });
    res.status(500).json({ error: 'Failed to submit review' });
  }
};

export const getMechanicReviews = async (req: Request, res: Response) => {
  try {
    const mechanicId = req.params.id;
    const reviews = await Review.findAll({
      where: { mechanicId, status: 'Approved' },
      order: [['createdAt', 'DESC']]
    });
    res.json(reviews);
  } catch (error) {
    logger.error('get_mechanic_reviews_failed', { error });
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

export const getAllReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await Review.findAll({
      include: [{ model: Mechanic, attributes: ['mechanicName', 'businessName'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(reviews);
  } catch (error) {
    logger.error('get_all_reviews_failed', { error });
    res.status(500).json({ error: 'Failed to fetch all reviews' });
  }
};

export const updateReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, comments, ratingTimeliness, ratingFairness, ratingRecommendation, isProblemFixed } = req.body;

    const review = await Review.findByPk(Number(id));
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const updates: any = {};
    if (status && ['Pending', 'Approved', 'Rejected'].includes(status)) updates.status = status;
    if (comments !== undefined) updates.comments = comments;
    if (ratingTimeliness !== undefined) updates.ratingTimeliness = ratingTimeliness;
    if (ratingFairness !== undefined) updates.ratingFairness = ratingFairness;
    if (ratingRecommendation !== undefined) updates.ratingRecommendation = ratingRecommendation;
    if (isProblemFixed !== undefined) updates.isProblemFixed = isProblemFixed;

    await review.update(updates);
    await recalculateMechanicRating(review.mechanicId);
    res.json({ message: 'Review updated successfully', review });
  } catch (error) {
    logger.error('update_review_failed', { error });
    res.status(500).json({ error: 'Failed to update review' });
  }
};

export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const review = await Review.findByPk(Number(id));
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const mechanicId = review.mechanicId;
    await review.destroy();
    await recalculateMechanicRating(mechanicId);
    
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    logger.error('delete_review_failed', { error });
    res.status(500).json({ error: 'Failed to delete review' });
  }
};
