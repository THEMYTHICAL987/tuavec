const express = require('express');
const router = express.Router();
const { Post, Category } = require('../models');
const { authenticate, optionalAuth, adminOnly } = require('../middleware/auth');
const { getPaginationData } = require('../utils/helpers');

// ========== GET ALL POSTS (PUBLIC) ==========
router.get('/', optionalAuth, async (req, res) => {
    try {
        const {
            category,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            page = 1,
            limit = 10,
            featured
        } = req.query;

        // Build query
        let query = { published: true };

        if (category) query.category = category;
        if (featured === 'true') query.featured = true; // Assuming we add featured to post

        // Search
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        // Count total
        const total = await Post.countDocuments(query);
        const pagination = getPaginationData(page, limit, total);

        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Fetch posts
        const posts = await Post.find(query)
            .populate('author', 'name')
            .sort(sort)
            .skip(pagination.skip)
            .limit(pagination.limit)
            .select('title slug excerpt category tags featuredImage publishedAt views likes createdAt');

        res.json({
            success: true,
            data: posts,
            pagination
        });

    } catch (error) {
        console.error('Get posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch posts'
        });
    }
});

// ========== GET SINGLE POST ==========
router.get('/:slug', optionalAuth, async (req, res) => {
    try {
        const { slug } = req.params;

        const post = await Post.findOneAndUpdate(
            { slug, published: true },
            { $inc: { views: 1 } },
            { new: true }
        )
        .populate('author', 'name')
        .populate('comments.user', 'name');

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        res.json({
            success: true,
            data: post
        });

    } catch (error) {
        console.error('Get post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch post'
        });
    }
});

// ========== CREATE POST (ADMIN ONLY) ==========
router.post('/', authenticate, adminOnly, async (req, res) => {
    try {
        const { title, content, excerpt, category, tags, featuredImage, published, seoTitle, seoDescription } = req.body;

        const post = new Post({
            title,
            content,
            excerpt,
            category,
            tags,
            featuredImage,
            published,
            seoTitle,
            seoDescription,
            author: req.user._id,
            publishedAt: published ? new Date() : null
        });

        await post.save();

        // Update category post count
        if (category) {
            await Category.findOneAndUpdate(
                { name: category },
                { $inc: { postCount: 1 } }
            );
        }

        res.status(201).json({
            success: true,
            data: post
        });

    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create post'
        });
    }
});

// ========== UPDATE POST (ADMIN ONLY) ==========
router.put('/:id', authenticate, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const post = await Post.findByIdAndUpdate(id, updates, { new: true });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        res.json({
            success: true,
            data: post
        });

    } catch (error) {
        console.error('Update post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update post'
        });
    }
});

// ========== DELETE POST (ADMIN ONLY) ==========
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;

        const post = await Post.findByIdAndDelete(id);

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        // Update category post count
        if (post.category) {
            await Category.findOneAndUpdate(
                { name: post.category },
                { $inc: { postCount: -1 } }
            );
        }

        res.json({
            success: true,
            message: 'Post deleted successfully'
        });

    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete post'
        });
    }
});

// ========== ADD COMMENT TO POST ==========
router.post('/:id/comments', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        const post = await Post.findById(id);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        post.comments.push({
            user: req.user._id,
            content
        });

        await post.save();

        res.status(201).json({
            success: true,
            message: 'Comment added successfully'
        });

    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add comment'
        });
    }
});

// ========== LIKE POST ==========
router.post('/:id/like', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const post = await Post.findByIdAndUpdate(
            id,
            { $inc: { likes: 1 } },
            { new: true }
        );

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        res.json({
            success: true,
            likes: post.likes
        });

    } catch (error) {
        console.error('Like post error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to like post'
        });
    }
});

module.exports = router;