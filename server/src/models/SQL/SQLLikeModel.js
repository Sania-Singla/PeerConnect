import { Ilikes } from '../../interfaces/likeInterface.js';
import { connection } from '../../server.js';
import { verifyOrderBy } from '../../utils/verifyOrderBy.js';

export class SQLlikes extends Ilikes {
    async getLikedPosts(userId, orderBy, limit, page) {
        try {
            verifyOrderBy(orderBy);
            const q = `
                    SELECT
                    	c.user_id,
                        c.user_name AS userName,
                        c.user_firstName AS firstName,
                        c.user_lastName lastName,
                        c.user_avatar AS avatar,
                        p.post_id, 
                        p.category_name,
                        p.post_updatedAt,
                        p.post_createdAt, 
                        p.post_title, 
                        p.post_content, 
                        p.totalViews,
                        p.post_image
                    FROM post_view p
                    JOIN channel_view c
                    ON p.post_ownerId = c.user_id 
                    JOIN post_likes l
                    ON p.post_id = l.post_id 
                    WHERE l.user_id = ? AND l.is_liked = 1
                    ORDER BY p.post_updatedAt ${orderBy.toUpperCase()} 
                    LIMIT ? OFFSET ?
                `;

            const countQ =
                'SELECT COUNT(*) AS totalPosts FROM post_likes WHERE user_id = ? AND is_liked = 1';

            const offset = (page - 1) * limit;

            const [[{ totalPosts }]] = await connection.query(countQ, [userId]);
            const [posts] = await connection.query(q, [userId, limit, offset]);

            if (!posts?.length) {
                return { message: 'NO_LIKED_POSTS' };
            }

            const totalPages = Math.ceil(totalPosts / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            return {
                postsInfo: {
                    totalPosts,
                    totalPages,
                    hasNextPage,
                    hasPrevPage,
                },
                posts,
            };
        } catch (err) {
            throw err;
        }
    }

    async togglePostLike(postId, userId, likedStatus) {
        try {
            const q = 'CALL togglePostLike(?, ?, ?)';
            const [[[response]]] = await connection.query(q, [
                userId,
                postId,
                likedStatus,
            ]);
            return response;
        } catch (err) {
            throw err;
        }
    }

    async toggleCommentLike(commentId, userId, likedStatus) {
        try {
            const q = 'CALL toggleCommentLike(?, ?, ?)';
            const [[[response]]] = await connection.query(q, [
                userId,
                commentId,
                likedStatus,
            ]);
            return response;
        } catch (err) {
            throw err;
        }
    }
}
