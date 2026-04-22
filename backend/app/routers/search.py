from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import SearchHistory, User
from ..schemas import SearchHistoryResponse, SearchHistoryList
from ..auth import get_current_user_optional, get_current_user
from sqlalchemy import func

router = APIRouter(prefix="/search", tags=["search"])

@router.post("/history")
def save_search(
    query: str = Query(..., min_length=1, max_length=200),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Save a search query. If user is logged in, associate with user_id.
    If guest, we could store in localStorage only (handled on frontend).
    """
    user_id = current_user.id if current_user else None
    
    # Check if this search already exists for this user
    existing = db.query(SearchHistory).filter(
        SearchHistory.user_id == user_id,
        func.lower(SearchHistory.search_query) == func.lower(query.strip())
    ).first()
    
    if existing:
        existing.search_count += 1
        db.commit()
        db.refresh(existing)
        return {"message": "Search updated", "search": existing}
    else:
        new_search = SearchHistory(
            user_id=user_id,
            search_query=query.strip()
        )
        db.add(new_search)
        db.commit()
        db.refresh(new_search)
        return {"message": "Search saved", "search": new_search}

@router.get("/history", response_model=SearchHistoryList)
def get_search_history(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get recent search history for logged-in user."""
    user_id = current_user.id if current_user else None
    
    if user_id is None:
        # For guests, return empty - frontend will use localStorage
        return {"searches": []}
    
    searches = db.query(SearchHistory).filter(
        SearchHistory.user_id == user_id
    ).order_by(SearchHistory.last_searched.desc()).limit(limit).all()
    
    return {"searches": searches}

@router.delete("/history/{search_id}")
def delete_search(
    search_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a specific search from history."""
    search = db.query(SearchHistory).filter(
        SearchHistory.id == search_id,
        SearchHistory.user_id == current_user.id
    ).first()
    
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")
    
    db.delete(search)
    db.commit()
    return {"message": "Search deleted"}

@router.delete("/history")
def clear_search_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clear all search history for the user."""
    db.query(SearchHistory).filter(
        SearchHistory.user_id == current_user.id
    ).delete()
    db.commit()
    return {"message": "Search history cleared"}

@router.get("/trending", response_model=SearchHistoryList)
def get_trending_searches(
    limit: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db)
):
    """Get trending searches across all users (for homepage suggestions)."""
    searches = db.query(SearchHistory).order_by(
        SearchHistory.search_count.desc()
    ).limit(limit).all()
    
    return {"searches": searches}