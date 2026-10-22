# EcoPath.AI — Security

## Architecture Security Principles

### Frontend
- No database credentials or secret keys in frontend code
- API communication via proxied requests (no direct database access)
- Input validation with Zod schemas on form submissions
- XSS prevention through React's default JSX escaping

### Backend
- Pydantic validation on all API inputs
- SQL injection prevention through SQLAlchemy ORM (parameterized queries)
- CORS restricted to configured origins
- File upload validation (type, size) for Eco-Scorer
- No permanent image storage by default

### Data
- SQLite for development (single-file, no network exposure)
- PostgreSQL recommended for production with proper authentication
- SECRET_KEY must be changed from default in production
- Environment variables for sensitive configuration

### Computer Vision
- Images processed in-memory, not stored permanently
- No cloud inference APIs — all processing is local
- Model weights from verified source (Apache 2.0 licence)

## Production Checklist

- [ ] Change SECRET_KEY from default
- [ ] Restrict CORS_ORIGINS to production domain
- [ ] Set DEBUG=false
- [ ] Use PostgreSQL with authentication
- [ ] Enable HTTPS via reverse proxy
- [ ] Set up database backups
- [ ] Review file upload limits
