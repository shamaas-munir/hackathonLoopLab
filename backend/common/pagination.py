from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

ALLOWED_PAGE_SIZES = (5, 10, 20, 50)


class StandardPagination(PageNumberPagination):
    """Server-side pagination. `count` is the total AFTER search/filters are applied."""

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50

    def get_page_size(self, request):
        try:
            size = int(request.query_params.get(self.page_size_query_param, self.page_size))
        except (TypeError, ValueError):
            return self.page_size
        return size if size in ALLOWED_PAGE_SIZES else self.page_size

    def get_paginated_response(self, data):
        return Response(
            {
                "results": data,
                "count": self.page.paginator.count,
                "page": self.page.number,
                "page_size": self.page.paginator.per_page,
                "total_pages": self.page.paginator.num_pages,
            }
        )

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "required": ["results", "count", "page", "page_size", "total_pages"],
            "properties": {
                "results": schema,
                "count": {"type": "integer"},
                "page": {"type": "integer"},
                "page_size": {"type": "integer"},
                "total_pages": {"type": "integer"},
            },
        }
