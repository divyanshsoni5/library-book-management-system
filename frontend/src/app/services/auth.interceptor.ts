import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { UserService } from './user.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('sgsits_auth_token') || localStorage.getItem('lms_auth_token');
  
  let currentUser: any = null;
  const portalUserStr = localStorage.getItem('sgsits_auth_user');
  if (portalUserStr) {
    try {
      const parsed = JSON.parse(portalUserStr);
      const r = (parsed.role || '').toUpperCase().trim();
      const sr = (parsed.subRole || '').toUpperCase().trim();
      
      let mappedRole = r;
      if (r === 'ADMIN' || (r === 'STAFF' && sr === 'LIBRARIAN')) {
        mappedRole = 'LIBRARIAN';
      } else if (r === 'FACULTY' || r === 'HEAD') {
        mappedRole = 'FACULTY';
      } else if (r === 'STUDENT') {
        mappedRole = 'STUDENT';
      }
      
      currentUser = { id: String(parsed.id), role: mappedRole };
    } catch (e) {}
  }
  
  if (!currentUser) {
    const localUserStr = localStorage.getItem('lms_current_user');
    if (localUserStr) {
      try {
        const parsed = JSON.parse(localUserStr);
        currentUser = { id: String(parsed.id), role: parsed.role.toUpperCase() };
      } catch (e) {}
    }
  }

  let headers = req.headers;
  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }
  if (currentUser) {
    headers = headers.set('X-User-Role', currentUser.role.toUpperCase());
    headers = headers.set('X-User-Id', currentUser.id);
  }

  const authReq = req.clone({ headers });
  return next(authReq);
};
